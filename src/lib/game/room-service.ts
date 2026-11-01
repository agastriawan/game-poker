import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { GameState } from "./types";

const LOCAL_ROOM_PREFIX = "poker_tongkrongan_room_";
const BROADCAST_CHANNEL_NAME = "poker_tongkrongan_sync";

/**
 * Menghasilkan kode room 6 karakter yang mudah dibaca (tanpa huruf membingungkan O/0/I/1).
 */
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

/**
 * Menyimpan state permainan ke localStorage dan memancarkan via BroadcastChannel (untuk multi-tab lokal)
 * serta menyimpan ke Supabase (untuk multiplayer online lintas perangkat).
 */
export async function persistGameState(
  state: GameState,
  waitForRemote = true
): Promise<void> {
  const code = state.roomCode.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // 1. Simpan ke localStorage & BroadcastChannel untuk sinkronisasi instan antar-tab
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${LOCAL_ROOM_PREFIX}${code}`, JSON.stringify(state));
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: "STATE_UPDATED", roomCode: code, state });
      bc.close();
    } catch {
      // Abaikan jika storage penuh atau diblokir
    }
  }

  // 2. Simpan ke tabel game_rooms di Supabase untuk sinkronisasi lintas perangkat (Device lain)
  const supabase = getSupabaseClient();
  if (supabase) {
    const upsertPromise = supabase.from("game_rooms").upsert(
      {
        room_code: code,
        host_id: state.hostId,
        phase: state.phase,
        round_number: state.roundNumber,
        state: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_code" }
    );

    if (waitForRemote) {
      const { error } = await upsertPromise;
      if (error) {
        console.warn("Supabase upsert warning:", error.message);
      }
    } else {
      upsertPromise.then(({ error }) => {
        if (error) console.warn("Supabase async upsert warning:", error.message);
      });
    }
  }
}

/**
 * Mengambil state permainan berdasarkan kode room (dari Supabase terlebih dahulu, lalu fallback localStorage).
 */
export async function fetchRoomState(roomCode: string): Promise<GameState | null> {
  const code = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code) return null;

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("game_rooms")
      .select("state")
      .eq("room_code", code)
      .maybeSingle();

    if (!error && data && data.state) {
      const remoteState = data.state as GameState;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `${LOCAL_ROOM_PREFIX}${code}`,
            JSON.stringify(remoteState)
          );
        } catch {
          // ignore
        }
      }
      return remoteState;
    }
  }

  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(`${LOCAL_ROOM_PREFIX}${code}`);
    if (raw) {
      try {
        return JSON.parse(raw) as GameState;
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Memanggil Server API (/api/game) untuk menjalankan aksi dan CSPRNG shuffle di sisi server,
 * lalu menyimpan hasilnya ke Supabase + Broadcast.
 */
export async function dispatchGameAction(
  action:
    | "create_room"
    | "create_bot_game"
    | "join_room"
    | "remove_player"
    | "start_round"
    | "submit_threes"
    | "play_cards"
    | "pass_turn"
    | "timeout_turn"
    | "send_taunt"
    | "forfeit_game",
  currentState?: GameState,
  payload?: Record<string, unknown>
): Promise<GameState> {
  const res = await fetch("/api/game", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      state: currentState,
      payload,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Gagal memproses langkah permainan.");
  }

  const nextState = data.state as GameState;
  const isPureBotGame =
    action === "create_bot_game" ||
    (nextState.players.length > 1 &&
      nextState.players.filter((p) => !p.isBot).length <= 1 &&
      action !== "create_room" &&
      action !== "join_room");

  // Untuk game lawan Bot murni, jangan blokir UI menunggu jaringan Supabase
  await persistGameState(nextState, !isPureBotGame);
  return nextState;
}

/**
 * Berlangganan (Subscribe) perubahan state room secara realtime
 * baik melalui Supabase Realtime maupun BroadcastChannel / storage event antar-tab.
 */
export function subscribeToRoom(
  roomCode: string,
  onUpdate: (newState: GameState) => void
): () => void {
  const code = roomCode.toUpperCase().trim();
  const cleanups: (() => void)[] = [];

  // 1. Listener BroadcastChannel & Storage (Multi-Tab Lokal)
  if (typeof window !== "undefined") {
    const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    const handleMessage = (ev: MessageEvent) => {
      if (ev.data?.type === "STATE_UPDATED" && ev.data?.roomCode === code) {
        onUpdate(ev.data.state as GameState);
      }
    };
    bc.addEventListener("message", handleMessage);

    const handleStorage = (ev: StorageEvent) => {
      if (ev.key === `${LOCAL_ROOM_PREFIX}${code}` && ev.newValue) {
        try {
          onUpdate(JSON.parse(ev.newValue) as GameState);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", handleStorage);

    cleanups.push(() => {
      bc.removeEventListener("message", handleMessage);
      bc.close();
      window.removeEventListener("storage", handleStorage);
    });
  }

  // 2. Listener Supabase Realtime + Polling Fallback Lintas Perangkat
  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured()) {
    let lastUpdatedAt = 0;

    const channel = supabase
      .channel(`room:${code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_rooms",
          filter: `room_code=eq.${code}`,
        },
        (payload) => {
          const row = payload.new as { state?: GameState } | undefined;
          if (row && row.state && row.state.updatedAt >= lastUpdatedAt) {
            lastUpdatedAt = row.state.updatedAt;
            onUpdate(row.state);
          }
        }
      )
      .subscribe();

    const pollInterval = setInterval(async () => {
      const { data, error } = await supabase
        .from("game_rooms")
        .select("state")
        .eq("room_code", code)
        .maybeSingle();
      if (!error && data?.state) {
        const remote = data.state as GameState;
        if (remote.updatedAt > lastUpdatedAt) {
          lastUpdatedAt = remote.updatedAt;
          onUpdate(remote);
        }
      }
    }, 2000);

    cleanups.push(() => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    });
  }

  return () => {
    for (const fn of cleanups) fn();
  };
}

