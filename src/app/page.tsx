"use client";

import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import {
  BookOpen,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dices,
  Download,
  Edit3,
  Loader2,
  LogIn,
  Menu,
  Music,
  Play,
  PlusCircle,
  Smartphone,
  Swords,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import GameTable from "@/components/GameTable";
import PlayingCard from "@/components/PlayingCard";
import { CHARACTER_PROFILES } from "@/components/PlayerSeat3D";
import RulesModal from "@/components/RulesModal";
import DownloadModal from "@/components/DownloadModal";
import OrientationToggleBtn from "@/components/OrientationToggleBtn";

const Model3DAvatar = dynamic(() => import("@/components/Model3DAvatar"), {
  ssr: false,
});
import { soundEngine } from "@/lib/audio/sound-engine";
import {
  dispatchGameAction,
  fetchRoomState,
  generateRoomCode,
  subscribeToRoom,
} from "@/lib/game/room-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { BotDifficulty, Card, GameState } from "@/lib/game/types";

const SESSION_PLAYER_ID_KEY = "poker_tongkrongan_player_id";
const SESSION_PLAYER_NAME_KEY = "poker_tongkrongan_player_name";
const SESSION_AVATAR_IDX_KEY = "poker_tongkrongan_avatar_idx";
const SESSION_ACTIVE_ROOM_KEY = "poker_tongkrongan_active_room";

const COOL_NICKNAMES = [
  "Sultan Sekop",
  "Raja Bom 99",
  "Dewa Kumpul 3",
  "Si Tukang Bluff",
  "Master Poker",
  "Bos Tongkrongan",
  "Ratu FullHouse",
];

const HERO_THEMES = [
  {
    glow: "rgba(217, 70, 239, 0.28)",
    tag: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
  },
  {
    glow: "rgba(56, 189, 248, 0.28)",
    tag: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  },
  {
    glow: "rgba(244, 63, 94, 0.28)",
    tag: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  },
  {
    glow: "rgba(16, 185, 129, 0.28)",
    tag: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
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
  const [isDownloadOpen, setIsDownloadOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"bot" | "mabar">("mabar");
  const [selectedBotPlayerCount, setSelectedBotPlayerCount] = useState<2 | 3 | 4>(4);
  const [isEditingNickname, setIsEditingNickname] = useState<boolean>(false);
  const [tempNickname, setTempNickname] = useState<string>("");
  const [isNavMenuOpen, setIsNavMenuOpen] = useState<boolean>(false);
  const navMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        navMenuRef.current &&
        !navMenuRef.current.contains(event.target as Node)
      ) {
        setIsNavMenuOpen(false);
      }
    }
    if (isNavMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNavMenuOpen]);
  const [charBubbleText, setCharBubbleText] = useState<string>(
    CHARACTER_PROFILES[0].quote
  );
  const [bgmOn, setBgmOn] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return soundEngine.isBgmActive();
    }
    return false;
  });
  const [sfxOn, setSfxOn] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return soundEngine.isSfxActive();
    }
    return true;
  });
  const [bgmVolume, setBgmVolume] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return soundEngine.getBgmVolume();
    }
    return 0.18;
  });
  const [botTurnLimit, setBotTurnLimit] = useState<number>(20);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("medium");

  const supabaseReady = isSupabaseConfigured();

  // Inisialisasi identitas pemain unik per tab browser
  useEffect(() => {
    if (typeof window === "undefined") return;
    setBgmOn(soundEngine.isBgmActive());
    setSfxOn(soundEngine.isSfxActive());
    setBgmVolume(soundEngine.getBgmVolume());
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

    // Periksa apakah pemain membuka link undangan (?room=... atau ?join=...)
    const urlParams = new URLSearchParams(window.location.search);
    const inviteParam = (urlParams.get("room") || urlParams.get("join") || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (inviteParam) {
      setJoinCodeInput(inviteParam);
      // Bersihkan parameter dari URL agar rapi dan tidak memicu redirect berulang
      window.history.replaceState({}, "", window.location.pathname);
      const effectiveName =
        savedName || `Sobat ${storedId.slice(-3).toUpperCase()}`;
      joinTargetRoom(inviteParam, storedId, effectiveName);
      return;
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
    setCharBubbleText(`Panggil aku "${pick}"!`);
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

  const joinTargetRoom = async (
    targetCode: string,
    currentId: string,
    currentName: string
  ) => {
    const code = targetCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) return;
    soundEngine.playCardSlam(false);
    setLoading(true);
    setLoadingLabel(`Menghubungkan ke Meja ${code}...`);
    setErrorMsg(null);
    try {
      const existingState = await fetchRoomState(code);
      if (!existingState) {
        throw new Error(
          `Room "${code}" tidak ditemukan. Pastikan kode atau link valid.`
        );
      }

      if (existingState.players.some((p) => p.id === currentId)) {
        setActiveGameState(existingState);
        return;
      }

      const nextState = await dispatchGameAction("join_room", existingState, {
        playerId: currentId,
        playerName: currentName,
        isBot: false,
      });
      setActiveGameState(nextState);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal bergabung ke meja."
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
    await joinTargetRoom(code, activeId, cleanName);
  };

  // Main Cepat vs Bot (1-Request Instan di Server!)
  const handleQuickPlayWithBots = async (
    totalPlayers: 2 | 3 | 4,
    turnLimit: number = botTurnLimit,
    difficulty: BotDifficulty = botDifficulty
  ) => {
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
        turnDurationLimit: turnLimit,
        botDifficulty: difficulty,
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
    <div className="relative h-dvh max-h-dvh w-full overflow-y-auto lg:overflow-hidden flex flex-col justify-between casino-hall-bg text-white px-2.5 sm:px-6 py-2 select-none safe-top-inset">
      {/* Ambient Radial Spotlight (Warna dinamis menyesuaikan hero aktif) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full blur-[130px] opacity-65 transition-colors duration-700"
          style={{ backgroundColor: HERO_THEMES[avatarIdx].glow }}
        />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      </div>

      {/* ================================================================= */}
      {/* 1. TOP HEADER: FLOATING MODERN GLASS NAVBAR (SERAGAM DENGAN LOBBY) */}
      {/* ================================================================= */}
      <header className="relative z-30 w-full max-w-7xl mx-auto flex items-center justify-between px-3 py-2 rounded-2xl modern-glass-panel shadow-2xl border border-white/10 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <img
            src="/logo.png"
            alt="Poker Barudak"
            className="h-8 sm:h-10 w-auto object-contain drop-shadow-[0_2px_12px_rgba(245,158,11,0.5)] select-none"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs sm:text-base tracking-wider text-white">
                POKER BARUDAK
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-semibold hidden sm:block">
              Capsa Banting 3D Online Tongkrongan
            </p>
          </div>
        </div>

        {/* Action Buttons: Aturan, Fullscreen, dan Menu Hamburger */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Rules Button */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playCardClick();
              setIsRulesOpen(true);
            }}
            title="Buku Panduan Aturan Main"
            className="modern-glass-pill px-3 py-1.5 rounded-xl text-slate-200 hover:text-white transition flex items-center gap-1.5 text-xs font-bold shadow-sm active:scale-95 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Aturan</span>
          </button>

          {/* Fullscreen Toggle */}
          <OrientationToggleBtn size="sm" />

          {/* Hamburger Menu Popover */}
          <div className="relative" ref={navMenuRef}>
            <button
              type="button"
              onClick={() => setIsNavMenuOpen((prev) => !prev)}
              title="Menu Pengaturan"
              className="modern-glass-pill px-3 py-1.5 rounded-xl text-slate-200 hover:text-white transition flex items-center gap-1.5 text-xs font-bold shadow-sm active:scale-95"
            >
              {isNavMenuOpen ? (
                <X className="w-4 h-4 text-amber-400" />
              ) : (
                <Menu className="w-4 h-4 text-amber-400" />
              )}
              <span className="hidden sm:inline">Menu</span>
            </button>

            {isNavMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-64 modern-glass-panel rounded-2xl p-3.5 shadow-2xl z-50 space-y-3 animate-taunt-pop border border-white/15"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-xs font-black text-amber-300 uppercase tracking-wider">
                  <span>Menu & Opsi</span>
                  <button
                    onClick={() => setIsNavMenuOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* BGM Toggle */}
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-200 font-bold">
                    <Music className="w-3.5 h-3.5 text-amber-400" /> Musik (BGM)
                  </span>
                  <button
                    onClick={handleToggleBgm}
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border transition ${
                      bgmOn
                        ? "bg-amber-400 text-slate-950 border-amber-300 font-black"
                        : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    {bgmOn ? "ON" : "OFF"}
                  </button>
                </div>

                {/* Volume Slider */}
                {bgmOn && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                      <span>Volume</span>
                      <span className="text-amber-300">
                        {Math.round(bgmVolume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(bgmVolume * 100)}
                      onChange={(e) => {
                        const val = Number(e.target.value) / 100;
                        setBgmVolume(val);
                        soundEngine.setBgmVolume(val);
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>
                )}

                {/* SFX Toggle */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
                  <span className="flex items-center gap-1.5 text-slate-200 font-bold">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> Efek Suara
                  </span>
                  <button
                    onClick={handleToggleSfx}
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border transition ${
                      sfxOn
                        ? "bg-emerald-400 text-slate-950 border-emerald-300 font-black"
                        : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    {sfxOn ? "ON" : "OFF"}
                  </button>
                </div>

                {/* Unduh APK */}
                <div className="pt-1.5 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNavMenuOpen(false);
                      setIsDownloadOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-emerald-300 hover:text-emerald-200 transition flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Unduh File APK Android</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* 2. MAIN HUB: DUA KOLOM BERGAYA GAME STUDIO (DESKTOP & HP)          */}
      {/* ================================================================= */}
      <main className="relative z-20 w-full max-w-7xl mx-auto flex-1 min-h-0 flex items-center justify-center p-1 sm:p-3">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6 items-center">
          {/* KOLOM KIRI: HERO 3D SHOWCASE (TAMPIL DI SEMUA LAYAR) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center text-center relative py-1">
            {/* 3D Model Stage */}
            <div className="relative flex flex-col items-center">
              {/* Balon Kutipan Hero yang Elegan */}
              <div className="mb-1 sm:mb-2 px-3 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-[11px] sm:text-xs text-amber-200 font-semibold italic max-w-xs truncate shadow-lg">
                &ldquo;{activeProfile.quote}&rdquo;
              </div>

              {/* 3D Model Canvas Container */}
              <div className="relative w-36 h-40 sm:w-52 sm:h-60 lg:w-68 lg:h-76 flex items-center justify-center">
                {/* Glowing Pedestal di Bawah Kaki */}
                <div
                  className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 w-28 sm:w-44 h-8 sm:h-10 hero-glow-pedestal blur-md transition-colors duration-700"
                  style={{
                    background: `radial-gradient(ellipse at center, ${HERO_THEMES[avatarIdx].glow} 0%, rgba(0,0,0,0.6) 65%, transparent 80%)`,
                  }}
                />

                <Model3DAvatar
                  modelPath={activeProfile.modelPath}
                  focus="full"
                  autoRotate={true}
                  className="w-full h-full"
                  fallback={
                    <div className="w-20 h-20 rounded-2xl bg-slate-900 border-2 border-amber-400 flex items-center justify-center text-amber-300 font-black text-sm shadow-xl">
                      {activeProfile.heroName}
                    </div>
                  }
                />
              </div>

              {/* Info Nama Hero & Role */}
              <div className="mt-1 space-y-0.5">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-sm sm:text-lg font-black tracking-wide text-white">
                    {activeProfile.heroName.toUpperCase()}
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${HERO_THEMES[avatarIdx].tag}`}
                  >
                    {activeProfile.role}
                  </span>
                </div>
              </div>

              {/* Hero Switcher Bar (4 Pilihan Avatar) */}
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() =>
                    handleSelectAvatar(
                      (avatarIdx - 1 + CHARACTER_PROFILES.length) %
                        CHARACTER_PROFILES.length
                    )
                  }
                  className="w-7 h-7 rounded-xl modern-glass-pill hover:bg-white/10 text-slate-300 flex items-center justify-center transition cursor-pointer"
                  title="Hero Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1">
                  {CHARACTER_PROFILES.map((prof, idx) => {
                    const isSelected = avatarIdx === idx;
                    return (
                      <button
                        key={prof.id}
                        type="button"
                        onClick={() => handleSelectAvatar(idx)}
                        className={[
                          "px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer",
                          isSelected
                            ? "bg-amber-400 text-slate-950 font-black shadow-lg scale-105"
                            : "modern-glass-pill text-slate-300 hover:text-white",
                        ].join(" ")}
                      >
                        <span>{prof.icon}</span>
                        <span className="hidden sm:inline text-[10px]">
                          {prof.heroName}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleSelectAvatar(
                      (avatarIdx + 1) % CHARACTER_PROFILES.length
                    )
                  }
                  className="w-7 h-7 rounded-xl modern-glass-pill hover:bg-white/10 text-slate-300 flex items-center justify-center transition cursor-pointer"
                  title="Hero Selanjutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN: GAME LAUNCHER HUB (CARD UTAMA DENGAN TAB VS BOT & MABAR) */}
          <div className="lg:col-span-7 w-full max-w-xl mx-auto modern-glass-panel rounded-2xl sm:rounded-3xl p-3 sm:p-5 space-y-2.5 sm:space-y-3.5">
            {/* Player Profile Header Bar */}
            <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-base shrink-0">
                  {activeProfile.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Nama Kamu di Meja
                  </div>
                  {isEditingNickname ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="text"
                        maxLength={15}
                        value={tempNickname}
                        onChange={(e) => setTempNickname(e.target.value)}
                        placeholder="Ketik nama..."
                        className="px-2 py-0.5 rounded-lg bg-slate-900 border border-amber-400/50 text-xs font-black text-amber-100 focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (tempNickname.trim()) {
                            savePlayerName(tempNickname.trim());
                          }
                          setIsEditingNickname(false);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-black cursor-pointer"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingNickname(false)}
                        className="text-slate-400 text-xs hover:text-white cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-black text-amber-200 truncate">
                        {playerName}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTempNickname(playerName);
                          setIsEditingNickname(true);
                        }}
                        className="text-slate-400 hover:text-amber-300 text-[11px] p-0.5 cursor-pointer"
                        title="Ubah Nama"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tombol Acak Nama */}
              <button
                type="button"
                onClick={handleRandomNickname}
                className="modern-glass-pill px-2.5 py-1 rounded-xl hover:bg-white/10 text-amber-300 flex items-center gap-1 text-[10px] font-bold shrink-0 transition cursor-pointer"
                title="Acak Nama Gaul Tongkrongan"
              >
                <Dices className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Acak</span>
              </button>
            </div>

            {/* Error Message if any */}
            {errorMsg && (
              <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center justify-between">
                <span>{errorMsg}</span>
                <button
                  onClick={() => setErrorMsg(null)}
                  className="text-rose-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* MODE SWITCHER TABS (MABAR ONLINE DI KIRI / DEFAULT) */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/40 border border-white/5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playCardClick();
                  setActiveTab("mabar");
                }}
                className={[
                  "py-1.5 sm:py-2 px-3 rounded-xl font-black text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer",
                  activeTab === "mabar"
                    ? "bg-amber-400 text-slate-950 shadow-md font-black"
                    : "text-slate-400 hover:text-white",
                ].join(" ")}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Mabar Online</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playCardClick();
                  setActiveTab("bot");
                }}
                className={[
                  "py-1.5 sm:py-2 px-3 rounded-xl font-black text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer",
                  activeTab === "bot"
                    ? "bg-amber-400 text-slate-950 shadow-md font-black"
                    : "text-slate-400 hover:text-white",
                ].join(" ")}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Main Lawan Bot</span>
              </button>
            </div>

            {/* TAB CONTENT 1: MAIN LAWAN BOT */}
            {activeTab === "bot" && (
              <div className="space-y-2.5 sm:space-y-3 animate-fade-in">
                {/* 1. Pilih Formasi Pemain */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-slate-300">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-amber-400" /> Formasi Pemain:
                    </span>
                    <span className="text-[10px] text-amber-300 font-extrabold">
                      {selectedBotPlayerCount === 4
                        ? "13 Kartu / Orang"
                        : selectedBotPlayerCount === 3
                        ? "17–18 Kartu / Orang"
                        : "26 Kartu / Orang"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { count: 4, label: "4 Pemain" },
                      { count: 3, label: "3 Pemain" },
                      { count: 2, label: "Duel 1v1" },
                    ].map(({ count, label }) => {
                      const isSelected = selectedBotPlayerCount === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => {
                            soundEngine.playCardClick();
                            setSelectedBotPlayerCount(count as 2 | 3 | 4);
                          }}
                          className={[
                            "py-1.5 rounded-xl text-center text-xs font-bold border transition cursor-pointer",
                            isSelected
                              ? "bg-amber-400/25 border-amber-400 text-amber-200 font-black ring-1 ring-amber-400"
                              : "bg-white/[0.02] border-white/5 hover:border-white/20 text-slate-400",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Tingkat Kesulitan Bot */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-slate-300">
                    <span className="flex items-center gap-1">
                      <Swords className="w-3 h-3 text-amber-400" /> Level Bot:
                    </span>
                    <span className="text-[10px] font-extrabold text-amber-300">
                      {botDifficulty === "easy"
                        ? "Santai"
                        : botDifficulty === "hard"
                        ? "Pro"
                        : "Menengah"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "easy", label: "Santai" },
                      { id: "medium", label: "Menengah" },
                      { id: "hard", label: "Pro" },
                    ].map((lvl) => {
                      const isSelected = botDifficulty === lvl.id;
                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => {
                            soundEngine.playCardClick();
                            setBotDifficulty(lvl.id as BotDifficulty);
                          }}
                          className={[
                            "py-1.5 rounded-xl text-center text-xs font-bold border transition cursor-pointer",
                            isSelected
                              ? "bg-amber-400/25 border-amber-400 text-amber-200 font-black ring-1 ring-amber-400"
                              : "bg-white/[0.02] border-white/5 hover:border-white/20 text-slate-400",
                          ].join(" ")}
                        >
                          {lvl.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Waktu Giliran */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-slate-300">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" /> Waktu Giliran:
                    </span>
                    <span className="text-[10px] font-extrabold text-amber-300">
                      {botTurnLimit === 0 ? "∞ Bebas" : `${botTurnLimit} Detik`}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { dur: 20, label: "20s" },
                      { dur: 30, label: "30s" },
                      { dur: 40, label: "40s" },
                      { dur: 0, label: "∞ Bebas" },
                    ].map(({ dur, label }) => {
                      const isSelected = botTurnLimit === dur;
                      return (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => {
                            soundEngine.playCardClick();
                            setBotTurnLimit(dur);
                          }}
                          className={[
                            "py-1.5 rounded-xl text-center text-xs font-bold border transition cursor-pointer",
                            isSelected
                              ? "bg-amber-400/25 border-amber-400 text-amber-200 font-black ring-1 ring-amber-400"
                              : "bg-white/[0.02] border-white/5 hover:border-white/20 text-slate-400",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Big Launch Button */}
                <button
                  type="button"
                  onClick={() =>
                    handleQuickPlayWithBots(
                      selectedBotPlayerCount,
                      botTurnLimit,
                      botDifficulty
                    )
                  }
                  disabled={loading}
                  className="w-full py-2.5 sm:py-3 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-teal-600 hover:from-emerald-400 hover:to-green-400 text-white font-black text-xs sm:text-sm tracking-wider shadow-[0_4px_25px_rgba(16,185,129,0.45)] transition transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-1 animate-cta-green-pulse"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>MAIN SEKARANG</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* TAB CONTENT 2: MABAR ONLINE */}
            {activeTab === "mabar" && (
              <div className="space-y-2.5 sm:space-y-3 animate-fade-in">
                {/* 1. Buat Room Mabar Baru */}
                <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <PlusCircle className="w-3.5 h-3.5 text-amber-400" /> Buat Meja Baru (Host)
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Dapatkan kode 6-digit untuk dibagikan ke teman, atau tambah bot di dalam meja.
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    disabled={loading}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 via-green-500 to-teal-600 hover:from-emerald-400 hover:to-green-400 text-white font-black text-xs shadow-[0_4px_20px_rgba(16,185,129,0.4)] transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer animate-cta-green-pulse"
                  >
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlusCircle className="w-3.5 h-3.5" />
                    )}
                    <span>Buat Meja Mabar Baru</span>
                  </button>
                </div>

                {/* 2. Gabung Meja Teman */}
                <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                  <div className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <LogIn className="w-3.5 h-3.5 text-amber-400" /> Masuk Meja Teman
                  </div>
                  <form onSubmit={handleJoinRoom} className="flex gap-1.5">
                    <input
                      type="text"
                      maxLength={8}
                      value={joinCodeInput}
                      onChange={(e) =>
                        setJoinCodeInput(e.target.value.toUpperCase())
                      }
                      placeholder="KODE ROOM (Cth: AB3X9K)"
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-400 focus:outline-none font-mono font-black text-center text-xs tracking-widest text-amber-300 uppercase"
                    />
                    <button
                      type="submit"
                      disabled={loading || !joinCodeInput.trim()}
                      title="Gabung Meja"
                      className="w-10 h-9 sm:w-11 sm:h-9 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 disabled:opacity-40 text-slate-950 font-black flex items-center justify-center transition shrink-0 shadow-lg cursor-pointer"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LogIn className="w-4 h-4 stroke-[2.5]" />
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Spacer Bawah Ringkas */}
      <div className="h-1 shrink-0" />

      {/* Animasi Loading Saat Masuk Room / Mengocok Kartu */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs bg-slate-950/95 border-2 border-amber-400/70 rounded-3xl p-6 text-center space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.95)] animate-taunt-pop">
            <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-amber-400/20" />
              <div className="absolute inset-0 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
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

      <DownloadModal
        isOpen={isDownloadOpen}
        onClose={() => setIsDownloadOpen(false)}
      />
    </div>
  );
}
