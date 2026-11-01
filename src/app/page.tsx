"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  Bot,
  Dices,
  Loader2,
  LogIn,
  Music,
  PlusCircle,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import GameTable from "@/components/GameTable";
import PlayingCard from "@/components/PlayingCard";
import { CHARACTER_PROFILES } from "@/components/PlayerSeat3D";
import RulesModal from "@/components/RulesModal";
import { soundEngine } from "@/lib/audio/sound-engine";
import {
  dispatchGameAction,
  fetchRoomState,
  generateRoomCode,
  subscribeToRoom,
} from "@/lib/game/room-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Card, GameState } from "@/lib/game/types";

const SESSION_PLAYER_ID_KEY = "poker_tongkrongan_player_id";
const SESSION_PLAYER_NAME_KEY = "poker_tongkrongan_player_name";
const SESSION_AVATAR_IDX_KEY = "poker_tongkrongan_avatar_idx";
const SESSION_ACTIVE_ROOM_KEY = "poker_tongkrongan_active_room";

const SHOWCASE_CARDS: Card[] = [
  { id: "3-spades", rank: "3", value: 3, suit: "spades" },
  { id: "J-diamonds", rank: "J", value: 11, suit: "diamonds" },
  { id: "Q-clubs", rank: "Q", value: 12, suit: "clubs" },
  { id: "K-hearts", rank: "K", value: 13, suit: "hearts" },
  { id: "2-spades", rank: "2", value: 15, suit: "spades" },
];

const COOL_NICKNAMES = [
  "Sultan Sekop",
  "Raja Bom 99",
  "Dewa Kumpul 3",
  "Si Tukang Bluff",
  "Master Poker",
  "Bos Tongkrongan",
  "Ratu FullHouse",
];

export default function HomePage() {
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("Pemain 1");
  const [avatarIdx, setAvatarIdx] = useState<number>(0);
  const [joinCodeInput, setJoinCodeInput] = useState<string>("");
  const [activeGameState, setActiveGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [selectedShowcaseIds, setSelectedShowcaseIds] = useState<string[]>([
    "3-spades",
    "2-spades",
  ]);
  const [charBubbleText, setCharBubbleText] = useState<string>(
    CHARACTER_PROFILES[0].quote
  );
  const [bgmOn, setBgmOn] = useState<boolean>(false);
  const [sfxOn, setSfxOn] = useState<boolean>(true);

  const supabaseReady = isSupabaseConfigured();

  // Inisialisasi identitas pemain unik per tab browser
  useEffect(() => {
    if (typeof window === "undefined") return;
    let storedId = sessionStorage.getItem(SESSION_PLAYER_ID_KEY);
    if (!storedId) {
      const randBytes = new Uint8Array(4);
      crypto.getRandomValues(randBytes);
      const hex = Array.from(randBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      storedId = `player-${hex}`;
      sessionStorage.setItem(SESSION_PLAYER_ID_KEY, storedId);
    }
    setPlayerId(storedId);

    const savedName = sessionStorage.getItem(SESSION_PLAYER_NAME_KEY);
    if (savedName) {
      setPlayerName(savedName);
    } else {
      setPlayerName(`Sobat ${storedId.slice(-3).toUpperCase()}`);
    }

    const savedAvatar = sessionStorage.getItem(SESSION_AVATAR_IDX_KEY);
    if (savedAvatar !== null) {
      const idx = Number(savedAvatar) % CHARACTER_PROFILES.length;
      setAvatarIdx(idx);
      setCharBubbleText(CHARACTER_PROFILES[idx].quote);
    }

    // Pulihkan room aktif jika pemain tidak sengaja menekan tombol Refresh
    const savedActiveRoom =
      sessionStorage.getItem(SESSION_ACTIVE_ROOM_KEY) ||
      localStorage.getItem(SESSION_ACTIVE_ROOM_KEY);
    if (savedActiveRoom) {
      const localRaw = localStorage.getItem(
        `poker_tongkrongan_room_${savedActiveRoom.toUpperCase()}`
      );
      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw) as GameState;
          if (parsed.players.some((p) => p.id === storedId)) {
            setActiveGameState(parsed);
          }
        } catch {
          // ignore
        }
      }
      fetchRoomState(savedActiveRoom).then((remoteState) => {
        if (remoteState && remoteState.players.some((p) => p.id === storedId)) {
          setActiveGameState(remoteState);
        }
      });
    }
  }, []);

  // Simpan kode room aktif agar tahan terhadap Refresh sampai pemain benar-benar klik Keluar
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeGameState?.roomCode) {
      sessionStorage.setItem(SESSION_ACTIVE_ROOM_KEY, activeGameState.roomCode);
      localStorage.setItem(SESSION_ACTIVE_ROOM_KEY, activeGameState.roomCode);
    }
  }, [activeGameState?.roomCode]);

  // Berlangganan update realtime saat berada di dalam room
  useEffect(() => {
    if (!activeGameState?.roomCode) return;
    const unsubscribe = subscribeToRoom(
      activeGameState.roomCode,
      (updatedState) => {
        setActiveGameState(updatedState);
      }
    );
    return () => unsubscribe();
  }, [activeGameState?.roomCode]);

  const savePlayerName = (val: string) => {
    setPlayerName(val);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_PLAYER_NAME_KEY, val);
    }
  };

  const handleSelectAvatar = (idx: number) => {
    soundEngine.playCardClick();
    setAvatarIdx(idx);
    setCharBubbleText(CHARACTER_PROFILES[idx].quote);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_AVATAR_IDX_KEY, String(idx));
    }
  };

  const handleRandomNickname = () => {
    soundEngine.playCardClick();
    const pick =
      COOL_NICKNAMES[Math.floor(Math.random() * COOL_NICKNAMES.length)];
    savePlayerName(pick);
    setCharBubbleText(`Panggil aku "${pick}"! 🔥`);
  };

  const handleToggleShowcaseCard = (cardId: string) => {
    soundEngine.playCardSlam(cardId === "2-spades");
    setSelectedShowcaseIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    );
    if (cardId === "3-spades") {
      setCharBubbleText("3 Sekop (3♠) berhak jalan paling pertama! ♠️");
    } else if (cardId === "2-spades") {
      setCharBubbleText("Ingat! Poker (2) gak boleh ditaruh paling akhir! 💣");
    } else {
      setCharBubbleText("Kartu Kerajaan (J, Q, K) wajib ada minimal satu! 👑");
    }
  };

  const handleToggleBgm = () => {
    const active = soundEngine.toggleBgm();
    setBgmOn(active);
  };

  const handleToggleSfx = () => {
    const active = soundEngine.toggleSfx();
    setSfxOn(active);
  };

  const ensurePlayerId = (): string => {
    if (playerId) return playerId;
    if (typeof window !== "undefined") {
      const existing = sessionStorage.getItem(SESSION_PLAYER_ID_KEY);
      if (existing) {
        setPlayerId(existing);
        return existing;
      }
    }
    const randBytes = new Uint8Array(4);
    crypto.getRandomValues(randBytes);
    const hex = Array.from(randBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const newId = `player-${hex}`;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_PLAYER_ID_KEY, newId);
    }
    setPlayerId(newId);
    return newId;
  };

  // Buat Room Online Baru
  const handleCreateRoom = async () => {
    if (loading) return;
    const activeId = ensurePlayerId();
    const cleanName = playerName.trim() || "Pemain 1";
    soundEngine.playCardSlam(false);
    setLoading(true);
    setLoadingLabel("Membuat Room Mabar Online...");
    setErrorMsg(null);
    try {
      const roomCode = generateRoomCode();
      const state = await dispatchGameAction("create_room", undefined, {
        roomCode,
        hostId: activeId,
        hostName: cleanName,
      });
      setActiveGameState(state);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal membuat room baru."
      );
    } finally {
      setLoading(false);
      setLoadingLabel(null);
    }
  };

  // Gabung ke Room yang Sudah Ada
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const code = joinCodeInput.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const cleanName = playerName.trim() || "Pemain Baru";
    if (!code) {
      setErrorMsg("Masukkan kode room terlebih dahulu.");
      return;
    }

    const activeId = ensurePlayerId();
    soundEngine.playCardSlam(false);
    setLoading(true);
    setLoadingLabel(`Menghubungkan ke Room ${code}...`);
    setErrorMsg(null);
    try {
      const existingState = await fetchRoomState(code);
      if (!existingState) {
        throw new Error(
          `Room dengan kode "${code}" tidak ditemukan. Pastikan kode benar.`
        );
      }

      if (existingState.players.some((p) => p.id === activeId)) {
        setActiveGameState(existingState);
        return;
      }

      const nextState = await dispatchGameAction("join_room", existingState, {
        playerId: activeId,
        playerName: cleanName,
        isBot: false,
      });
      setActiveGameState(nextState);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal bergabung ke room."
      );
    } finally {
      setLoading(false);
      setLoadingLabel(null);
    }
  };

  // Main Cepat vs Bot (1-Request Instan di Server!)
  const handleQuickPlayWithBots = async (totalPlayers: 2 | 3 | 4) => {
    if (loading) return;
    const activeId = ensurePlayerId();
    const cleanName = playerName.trim() || "Pemain 1";
    soundEngine.playCardSlam(true);
    setLoading(true);
    setLoadingLabel(
      `Menyiapkan Meja ${totalPlayers} Pemain & Mengocok Kartu...`
    );
    setErrorMsg(null);
    try {
      const roomCode = generateRoomCode();
      const state = await dispatchGameAction("create_bot_game", undefined, {
        roomCode,
        hostId: activeId,
        hostName: cleanName,
        totalPlayers,
      });
      setActiveGameState(state);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal memulai permainan cepat."
      );
    } finally {
      setLoading(false);
      setLoadingLabel(null);
    }
  };

  const handleConfirmLeaveRoom = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SESSION_ACTIVE_ROOM_KEY);
      localStorage.removeItem(SESSION_ACTIVE_ROOM_KEY);
    }
    setActiveGameState(null);
  };

  if (activeGameState) {
    return (
      <GameTable
        gameState={activeGameState}
        myPlayerId={playerId}
        onStateChange={setActiveGameState}
        onLeaveRoom={handleConfirmLeaveRoom}
      />
    );
  }

  const activeProfile = CHARACTER_PROFILES[avatarIdx];

  return (
    <div className="relative h-dvh max-h-dvh w-full overflow-y-auto lg:overflow-hidden flex flex-col justify-between casino-hall-bg text-white px-3 sm:px-6 py-3 select-none">
      {/* Dekorasi Partikel Cahaya Kasino */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[550px] h-48 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute top-1/4 left-1/5 w-2 h-2 rounded-full bg-amber-300 animate-ambient-particle" />
        <div
          className="absolute top-1/3 right-1/4 w-2.5 h-2.5 rounded-full bg-purple-400 animate-ambient-particle"
          style={{ animationDelay: "1.2s" }}
        />
        <div
          className="absolute bottom-1/4 left-1/3 w-2 h-2 rounded-full bg-pink-400 animate-ambient-particle"
          style={{ animationDelay: "2.2s" }}
        />
      </div>

      {/* ================================================================= */}
      {/* TOP BAR RINGKAS: LOGO KIRI + TOMBOL AUDIO & ATURAN KANAN          */}
      {/* ================================================================= */}
      <header className="relative z-20 max-w-6xl w-full mx-auto shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Poker Barudak"
            className="h-12 sm:h-16 w-auto object-contain drop-shadow-[0_4px_14px_rgba(245,158,11,0.55)]"
          />
          <h1 className="font-black text-base sm:text-xl tracking-wide text-white leading-none">
            POKER BARUDAK
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleBgm}
            title="Nyalakan / Matikan Backsound"
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition",
              bgmOn
                ? "bg-amber-500/25 border-amber-400 text-amber-300"
                : "bg-slate-900/90 border-slate-700 text-slate-300 hover:text-white",
            ].join(" ")}
          >
            <Music className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {bgmOn ? "BGM On" : "BGM Off"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleToggleSfx}
            title="Nyalakan / Matikan Efek Suara"
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition",
              sfxOn
                ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-300"
                : "bg-slate-900/90 border-slate-700 text-slate-400",
            ].join(" ")}
          >
            {sfxOn ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">SFX</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRulesOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 border border-amber-400/50 text-xs font-extrabold text-amber-300 transition shadow-lg"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Aturan</span>
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* TENGAH: PANGGUNG KARAKTER 3D INTERAKTIF & PANEL MASUK PERMAINAN   */}
      {/* ================================================================= */}
      <main className="relative z-10 max-w-6xl w-full mx-auto flex-1 min-h-0 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-center">
          {/* KOLOM KIRI: PANGGUNG INTERAKTIF KARAKTER 3D & KARTU MEJA */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center space-y-3">
            {/* Panggung Meja Mini 3D + Karakter yang Bisa Diklik */}
            <div className="perspective-stage w-full max-w-md">
              <div className="table-3d-rim rounded-[60px] p-2.5 border-2 border-amber-400/50">
                <div className="felt-crimson rounded-[50px] border border-amber-300/40 px-4 py-4 flex flex-col items-center justify-center space-y-3 shadow-inner relative">
                  {/* Balon Dialog Interaktif Karakter */}
                  <div
                    key={charBubbleText}
                    className="px-3.5 py-1 rounded-2xl bg-gradient-to-r from-white via-amber-50 to-amber-100 text-slate-950 border-2 border-amber-400 shadow-lg text-xs font-black text-center animate-taunt-pop"
                  >
                    &ldquo;{charBubbleText}&rdquo;
                  </div>

                  {/* Avatar Karakter Besar Interaktif */}
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectAvatar(
                        (avatarIdx + 1) % CHARACTER_PROFILES.length
                      )
                    }
                    title="Klik untuk ganti karakter!"
                    className={[
                      "relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden border-2 border-amber-300 shadow-[0_10px_25px_rgba(0,0,0,0.8)] animate-float-char bg-gradient-to-b transition transform hover:scale-105 cursor-pointer",
                      activeProfile.gradient,
                    ].join(" ")}
                  >
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle
                        cx="50"
                        cy="45"
                        r="38"
                        fill="rgba(255,255,255,0.12)"
                      />
                      <path
                        d="M22 45 C18 75, 25 92, 50 92 C75 92, 82 75, 78 45 Z"
                        fill={activeProfile.hairColor}
                        opacity="0.85"
                      />
                      <path
                        d="M20 98 C22 74, 35 68, 50 68 C65 68, 78 74, 80 98 Z"
                        fill={activeProfile.outfitColor}
                      />
                      <polygon points="42,68 50,82 58,68" fill="#ffffff" />
                      <polygon points="46,74 54,74 50,85" fill="#f59e0b" />
                      <ellipse
                        cx="50"
                        cy="46"
                        rx="19"
                        ry="21"
                        fill="#fde6d8"
                      />
                      <ellipse
                        cx="42"
                        cy="47"
                        rx="3.2"
                        ry="4.2"
                        fill="#1e1b4b"
                      />
                      <ellipse
                        cx="58"
                        cy="47"
                        rx="3.2"
                        ry="4.2"
                        fill="#1e1b4b"
                      />
                      <circle cx="41" cy="45.5" r="1.2" fill="#ffffff" />
                      <circle cx="57" cy="45.5" r="1.2" fill="#ffffff" />
                      <path
                        d="M46 56 Q50 60 55 56"
                        stroke="#be123c"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                      />
                      <path
                        d="M29 42 C30 22, 70 22, 71 42 C65 31, 56 36, 50 29 C44 36, 35 31, 29 42 Z"
                        fill={activeProfile.hairColor}
                      />
                      <polygon
                        points="38,23 44,14 50,20 56,14 62,23"
                        fill="#fbbf24"
                        stroke="#78350f"
                        strokeWidth="1.2"
                      />
                    </svg>
                  </button>

                  {/* Selector 4 Karakter */}
                  <div className="flex items-center justify-center gap-1.5">
                    {CHARACTER_PROFILES.map((prof, idx) => (
                      <button
                        key={prof.id}
                        type="button"
                        onClick={() => handleSelectAvatar(idx)}
                        className={[
                          "px-2.5 py-1 rounded-full text-[10px] font-black transition border",
                          avatarIdx === idx
                            ? "bg-amber-400 text-slate-950 border-white shadow scale-105"
                            : "bg-slate-950/80 text-slate-300 border-slate-700 hover:border-amber-400/50",
                        ].join(" ")}
                      >
                        {prof.title}
                      </button>
                    ))}
                  </div>

                  {/* Barisan Kartu Interaktif */}
                  <div className="pt-2 flex items-center justify-center gap-1.5 sm:gap-2">
                    {SHOWCASE_CARDS.map((card) => (
                      <PlayingCard
                        key={card.id}
                        card={card}
                        size="md"
                        selected={selectedShowcaseIds.includes(card.id)}
                        onClick={() => handleToggleShowcaseCard(card.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN: KONTROL MASUK PERMAINAN (MABAR & VS BOT) */}
          <div className="lg:col-span-6 bg-slate-950/90 border-2 border-amber-400/40 rounded-3xl p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-xl space-y-4">
            {/* Input Nama Panggilan + Tombol Acak Nama */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-black uppercase tracking-wider text-amber-300">
                Nama Panggilan di Meja
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={18}
                  value={playerName}
                  onChange={(e) => savePlayerName(e.target.value)}
                  placeholder="Masukkan nama kamu..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-400 focus:outline-none text-white font-black text-sm"
                />
                <button
                  type="button"
                  onClick={handleRandomNickname}
                  title="Acak Nama Keren"
                  className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-400/40 text-amber-300 transition flex items-center gap-1 text-xs font-bold shrink-0"
                >
                  <Dices className="w-4 h-4" />
                  <span className="hidden sm:inline">Acak</span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-bold">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Opsi 1: Mabar Online Bersama Teman */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Mabar Online Bersama Teman
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {supabaseReady ? "🟢 Realtime Online" : "🟡 Multi-Tab"}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-60 text-slate-950 font-black text-xs sm:text-sm shadow-[0_6px_20px_rgba(245,158,11,0.3)] transition transform active:scale-95"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PlusCircle className="w-4 h-4" />
                )}
                Buat Room Mabar Baru (Dapatkan Kode)
              </button>

              <form onSubmit={handleJoinRoom} className="flex gap-2">
                <input
                  type="text"
                  maxLength={8}
                  value={joinCodeInput}
                  onChange={(e) =>
                    setJoinCodeInput(e.target.value.toUpperCase())
                  }
                  placeholder="KODE ROOM (Contoh: AB3X9K)"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-400 focus:outline-none font-mono font-black uppercase tracking-widest text-xs sm:text-sm text-amber-300"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60 text-slate-950 font-black text-xs sm:text-sm transition shrink-0 shadow-lg"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  Gabung
                </button>
              </form>
            </div>

            {/* Opsi 2: Langsung Main vs Bot 3D */}
            <div className="border-t border-slate-800 pt-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Bot className="w-4 h-4" /> Langsung Main vs Bot 3D
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  1-Klik Langsung Bagi Kartu
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleQuickPlayWithBots(4)}
                  disabled={loading}
                  className="group flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-900 hover:bg-amber-500/15 border border-slate-700 hover:border-amber-400 transition transform hover:-translate-y-0.5"
                >
                  <span className="font-black text-xs sm:text-sm text-amber-300 group-hover:scale-105 transition">
                    🔥 4 Pemain
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    13 Kartu / Org
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickPlayWithBots(3)}
                  disabled={loading}
                  className="group flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-900 hover:bg-emerald-500/15 border border-slate-700 hover:border-emerald-400 transition transform hover:-translate-y-0.5"
                >
                  <span className="font-black text-xs sm:text-sm text-emerald-300 group-hover:scale-105 transition">
                    ⚡ 3 Pemain
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    17–18 Kartu
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickPlayWithBots(2)}
                  disabled={loading}
                  className="group flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-900 hover:bg-sky-500/15 border border-slate-700 hover:border-sky-400 transition transform hover:-translate-y-0.5"
                >
                  <span className="font-black text-xs sm:text-sm text-sky-300 group-hover:scale-105 transition">
                    ⚔️ Duel 1v1
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    26 Kartu / Org
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Spacer Bawah Ringkas Tanpa Teks Panjang */}
      <div className="h-1 shrink-0" />

      {/* Animasi Loading Saat Masuk Room / Mengocok Kartu */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs bg-slate-950/95 border-2 border-amber-400/70 rounded-3xl p-6 text-center space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.95)] animate-taunt-pop">
            <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-amber-400/20" />
              <div className="absolute inset-0 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
              <span className="text-2xl">🃏</span>
            </div>
            <div className="text-sm font-black text-amber-300">
              {loadingLabel || "Memuat Meja Permainan..."}
            </div>
            <div className="text-[11px] text-slate-400 font-semibold">
              Mohon tunggu sebentar...
            </div>
          </div>
        </div>
      )}

      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        shuffleMeta={null}
        supabaseReady={supabaseReady}
      />
    </div>
  );
}
