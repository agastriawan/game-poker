import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  addPlayerToGame,
  createInitialGameState,
  forfeitPlayer,
  passTurn,
  playCards,
  removePlayerFromGame,
  sendTaunt,
  startNewRound,
  submitPlayerThrees,
  timeoutTurn,
  togglePlayerReady,
  updatePlayerProfile,
  updateRoomSettings,
} from "./engine";
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

export type GameActionType =
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
  | "forfeit_game"
  | "update_room_settings"
  | "toggle_ready"
  | "update_player_profile";

/**
 * Eksekusi langkah permainan langsung di memori lokal menggunakan pure engine.
 * Menjadi fail-safe / fallback mutlak jika koneksi internet terputus atau timeout,
 * menjamin permainan (khususnya lawan Bot) TIDAK PERNAH STUCK!
 */
export function executeLocalEngineAction(
  action: GameActionType,
  state?: GameState,
  payload?: Record<string, unknown>
): GameState {
  switch (action) {
    case "create_room":
      return createInitialGameState({
        roomCode: String(payload?.roomCode || "POKR01"),
        hostId: String(payload?.hostId || "host-1"),
        hostName: String(payload?.hostName || "Pemain 1"),
      });

    case "create_bot_game": {
      const roomCode = String(payload?.roomCode || "POKR01");
      const hostId = String(payload?.hostId || "host-1");
      const hostName = String(payload?.hostName || "Pemain 1");
      const totalPlayers = Math.min(
        4,
        Math.max(2, Number(payload?.totalPlayers || 4))
      );
      const turnDurationLimit =
        payload?.turnDurationLimit !== undefined
          ? Number(payload.turnDurationLimit)
          : 20;
      const botDifficulty =
        payload?.botDifficulty === "easy" ||
        payload?.botDifficulty === "hard" ||
        payload?.botDifficulty === "medium"
          ? payload.botDifficulty
          : "medium";

      let tempState = createInitialGameState({ roomCode, hostId, hostName });
      tempState = {
        ...tempState,
        players: tempState.players.map((p) =>
          p.id === hostId ? { ...p, isReady: true } : p
        ),
      };
      tempState = updateRoomSettings(tempState, {
        turnDurationLimit,
        botDifficulty,
      });

      const botNames = ["Bot Himiya", "Bot Riko", "Bot Sari"];
      for (let i = 0; i < totalPlayers - 1; i++) {
        tempState = addPlayerToGame(tempState, {
          id: `bot-${i + 1}-${Date.now()}-${i}`,
          name: botNames[i],
          isBot: true,
        });
      }
      return startNewRound(tempState);
    }

    case "join_room":
      if (!state) throw new Error("State room tidak ditemukan.");
      return addPlayerToGame(state, {
        id: String(payload?.playerId),
        name: String(payload?.playerName),
        isBot: Boolean(payload?.isBot),
      });

    case "remove_player":
      if (!state) throw new Error("State room tidak ditemukan.");
      return removePlayerFromGame(state, String(payload?.playerId || payload?.targetPlayerId));

    case "update_room_settings":
      if (!state) throw new Error("State room tidak ditemukan.");
      return updateRoomSettings(state, {
        turnDurationLimit:
          payload?.turnDurationLimit !== undefined
            ? Number(payload.turnDurationLimit)
            : undefined,
        botDifficulty:
          payload?.botDifficulty === "easy" ||
          payload?.botDifficulty === "hard" ||
          payload?.botDifficulty === "medium"
            ? payload.botDifficulty
            : undefined,
      });

    case "toggle_ready":
      if (!state) throw new Error("State room tidak ditemukan.");
      return togglePlayerReady(state, String(payload?.playerId));

    case "update_player_profile":
      if (!state) throw new Error("State room tidak ditemukan.");
      return updatePlayerProfile(state, String(payload?.playerId), {
        name: payload?.name ? String(payload.name) : undefined,
        seatIndex:
          payload?.seatIndex !== undefined ? Number(payload.seatIndex) : undefined,
      });

    case "start_round": {
      if (!state) throw new Error("State room tidak ditemukan.");
      const requesterId = payload?.playerId ? String(payload.playerId) : undefined;
      return startNewRound(state, requesterId);
    }

    case "submit_threes":
      if (!state) throw new Error("State room tidak ditemukan.");
      return submitPlayerThrees(state, String(payload?.playerId));

    case "play_cards":
      if (!state) throw new Error("State room tidak ditemukan.");
      return playCards(
        state,
        String(payload?.playerId),
        (payload?.cardIds as string[]) || []
      );

    case "pass_turn":
      if (!state) throw new Error("State room tidak ditemukan.");
      return passTurn(state, String(payload?.playerId));

    case "timeout_turn":
      if (!state) throw new Error("State room tidak ditemukan.");
      return timeoutTurn(state, String(payload?.playerId));

    case "send_taunt":
      if (!state) throw new Error("State room tidak ditemukan.");
      return sendTaunt(
        state,
        String(payload?.playerId),
        String(payload?.tauntId || "custom"),
        payload?.customText ? String(payload.customText) : undefined,
        payload?.customEmoji ? String(payload.customEmoji) : undefined
      );

    case "forfeit_game":
      if (!state) throw new Error("State room tidak ditemukan.");
      return forfeitPlayer(state, String(payload?.playerId));

    default:
      if (!state) throw new Error("Aksi tidak dikenal.");
      return state;
  }
}

/**
 * Memanggil Server API (/api/game) untuk menjalankan aksi dan CSPRNG shuffle di sisi server,
 * lalu menyimpan hasilnya ke Supabase + Broadcast.
 * Dilengkapi fallback otomatis ke engine lokal jika koneksi terputus/offline,
 * sehingga permainan (terutama lawan Bot) tidak pernah macet (stuck).
 */
export async function dispatchGameAction(
  action: GameActionType,
  currentState?: GameState,
  payload?: Record<string, unknown>
): Promise<GameState> {
  const isPureBotGame =
    action === "create_bot_game" ||
    (currentState &&
      currentState.players.length > 1 &&
      currentState.players.filter((p) => !p.isBot).length <= 1 &&
      action !== "create_room" &&
      action !== "join_room");

  let nextState: GameState;

  // Jika game lawan bot murni dan browser terdeteksi offline, langsung eksekusi lokal tanpa menunggu fetch network
  if (isPureBotGame && typeof navigator !== "undefined" && !navigator.onLine) {
    nextState = executeLocalEngineAction(action, currentState, payload);
    await persistGameState(nextState, false);
    return nextState;
  }

  try {
    const controller = new AbortController();
    // Gunakan timeout cepat (2.5 detik untuk bot game, 6 detik untuk mabar online)
    const timeoutMs = isPureBotGame ? 2500 : 6000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        state: currentState,
        payload,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || "Gagal memproses langkah permainan.");
    }

    nextState = data.state as GameState;
  } catch (err) {
    // FALLBACK KONEKSI PUTUS / OFFLINE / TIMEOUT:
    // Menjamin langkah (terutama aksi bot atau timeout) tidak pernah macet!
    console.warn(
      `[dispatchGameAction] Jaringan offline/terputus (${action}). Menjalankan engine lokal:`,
      err
    );
    nextState = executeLocalEngineAction(action, currentState, payload);
  }

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
      // Jika game ini adalah game lawan Bot murni, lewati polling remote
      // agar tidak menimpa state lokal saat terjadi koneksi putus-nyambung
      if (typeof window !== "undefined") {
        const rawLocal = localStorage.getItem(`${LOCAL_ROOM_PREFIX}${code}`);
        if (rawLocal) {
          try {
            const parsed = JSON.parse(rawLocal) as GameState;
            if (
              parsed.players &&
              parsed.players.filter((p) => !p.isBot).length <= 1
            ) {
              return;
            }
          } catch {}
        }
      }

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

