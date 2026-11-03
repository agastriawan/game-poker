"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  Dices,
  Edit2,
  Headphones,
  Link2,
  Loader2,
  LogOut,
  Menu,
  MessageSquareMore,
  Mic,
  MicOff,
  Music,
  Play,
  Settings,
  ShieldCheck,
  Swords,
  Trash2,
  User,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { BotDifficulty, GameState, PlayerState, TauntEvent } from "@/lib/game/types";
import { CHARACTER_PROFILES } from "./PlayerSeat3D";
import OrientationToggleBtn from "./OrientationToggleBtn";
import { soundEngine } from "@/lib/audio/sound-engine";

const Model3DAvatar = dynamic(() => import("./Model3DAvatar"), {
  ssr: false,
});

const COOL_NICKNAMES = [
  "Sultan Sekop",
  "Raja Bom 99",
  "Dewa Kumpul 3",
  "Si Tukang Bluff",
  "Master Poker",
  "Bos Tongkrongan",
  "Ratu FullHouse",
];

export interface WaitingRoomLobbyProps {
  gameState: GameState;
  myPlayer: PlayerState | null;
  isHost: boolean;
  isSubmitting: boolean;
  voice: {
    micEnabled: boolean;
    speakerEnabled: boolean;
    isConnectingMic: boolean;
    toggleMic: () => void;
    toggleSpeaker: () => void;
    peerMicOn: Record<string, boolean>;
    peerSpeaking: Record<string, boolean>;
  };
  visibleTaunts: Record<string, TauntEvent>;
  onDismissTaunt: () => void;
  onOpenChat: () => void;
  onToggleReady: () => void;
  onSaveProfile: (name?: string, avatarIdx?: number) => void;
  onAddBot: () => void;
  onRemovePlayer: (playerId: string) => void;
  onUpdateTurnLimit: (seconds: number) => void;
  onUpdateBotDifficulty?: (difficulty: BotDifficulty) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onOpenRules: () => void;
  bgmOn: boolean;
  onToggleBgm: () => void;
  sfxOn: boolean;
  onToggleSfx: () => void;
  copiedCode: boolean;
  copiedLink: boolean;
  onCopyCode: () => void;
  onShareInvite: () => void;
}

export default function WaitingRoomLobby({
  gameState,
  myPlayer,
  isHost,
  isSubmitting,
  voice,
  visibleTaunts,
  onOpenChat,
  onToggleReady,
  onSaveProfile,
  onAddBot,
  onRemovePlayer,
  onUpdateTurnLimit,
  onUpdateBotDifficulty,
  onStartGame,
  onLeaveRoom,
  onOpenRules,
  bgmOn,
  onToggleBgm,
  sfxOn,
  onToggleSfx,
  copiedCode,
  copiedLink,
  onCopyCode,
  onShareInvite,
}: WaitingRoomLobbyProps) {
  const [editingName, setEditingName] = useState(myPlayer?.name || "");
  const [isEditingActive, setIsEditingActive] = useState(false);
  const [isTableSettingsOpen, setIsTableSettingsOpen] = useState(false);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [bgmVolume, setBgmVolume] = useState<number>(() => soundEngine.getBgmVolume());

  const tableSettingsRef = useRef<HTMLDivElement>(null);
  const navMenuRef = useRef<HTMLDivElement>(null);

  // Tutup menu popover saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        tableSettingsRef.current &&
        !tableSettingsRef.current.contains(event.target as Node)
      ) {
        setIsTableSettingsOpen(false);
      }
      if (
        navMenuRef.current &&
        !navMenuRef.current.contains(event.target as Node)
      ) {
        setIsNavMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (myPlayer?.name && !isEditingActive) {
      setEditingName(myPlayer.name);
    }
  }, [myPlayer?.name, isEditingActive]);

  const handleRandomizeName = () => {
    soundEngine.playCardClick();
    const pick = COOL_NICKNAMES[Math.floor(Math.random() * COOL_NICKNAMES.length)];
    setEditingName(pick);
    setIsEditingActive(true);
    onSaveProfile(pick);
  };

  const handleCycleHero = (direction: "prev" | "next") => {
    soundEngine.playCardClick();
    if (!myPlayer) return;
    const currentIdx = myPlayer.seatIndex % CHARACTER_PROFILES.length;
    const nextIdx =
      direction === "next"
        ? (currentIdx + 1) % CHARACTER_PROFILES.length
        : (currentIdx - 1 + CHARACTER_PROFILES.length) % CHARACTER_PROFILES.length;
    onSaveProfile(undefined, nextIdx);
  };

  const humanPlayers = gameState.players.filter((p) => !p.isBot);
  const readyHumanCount = humanPlayers.filter((p) => p.isReady).length;
  const allHumansReady =
    humanPlayers.length > 0 && readyHumanCount === humanPlayers.length;
  const canStart = gameState.players.length >= 2 && allHumansReady;

  const currentTurnLimit = gameState.turnDurationLimit ?? 20;
  const currentBotDiff = gameState.botDifficulty || "medium";

  return (
    <div className="relative z-30 w-full h-full max-h-screen flex flex-col justify-between p-1.5 sm:p-2.5 lg:p-4 text-white max-w-7xl mx-auto select-none safe-top-inset overflow-hidden">
      {/* Ambient Radial Spotlight */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[140px] opacity-35 bg-amber-500/20" />
      </div>

      {/* ================================================================= */}
      {/* 1. TOP HEADER BAR: UNIFIED WITH MAIN MENU (MINIMALIST 3-BUTTON)   */}
      {/* ================================================================= */}
      <header className="relative z-20 flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl modern-glass-panel shadow-2xl border border-white/10 shrink-0">
        {/* Sisi Kiri: Logo & Chip Room */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Poker Barudak"
              className="h-8 sm:h-9 w-auto object-contain drop-shadow-[0_2px_12px_rgba(245,158,11,0.5)] select-none"
            />
            <div className="hidden xs:block sm:block">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs sm:text-sm font-black tracking-wider text-amber-300 uppercase leading-none">
                  POKER BARUDAK
                </h1>
              </div>
              <p className="text-[8px] sm:text-[9px] text-slate-400 font-semibold mt-0.5">
                Lobby Meja Mabar
              </p>
            </div>
          </div>

          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          {/* Chip Kode Room dengan 1-klik Salin & Undang Teman */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-black/40 border border-amber-400/30 px-2 sm:px-2.5 py-1 rounded-xl">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider hidden md:inline">
              Room:
            </span>
            <span className="font-mono font-black text-amber-300 text-xs sm:text-sm tracking-wider">
              #{gameState.roomCode}
            </span>

            <button
              type="button"
              onClick={onCopyCode}
              title="Salin Kode Room"
              className="p-1 rounded-lg hover:bg-white/10 text-amber-300 transition active:scale-95 cursor-pointer"
            >
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onShareInvite}
              title="Salin Link Meja untuk Teman"
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[9px] sm:text-[10px] shadow transition active:scale-95 ml-0.5 cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3 h-3 text-slate-950 stroke-[3]" />
                  <span className="hidden sm:inline">Tersalin!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Undang</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sisi Kanan: Action Buttons (Aturan Meja [Pengaturan Game], Fullscreen, dan Menu Hamburger) */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          {/* Tombol Aturan Meja (Pengaturan Meja Game: Waktu Giliran & Kesulitan Bot) */}
          <div className="relative" ref={tableSettingsRef}>
            <button
              type="button"
              onClick={() => {
                setIsTableSettingsOpen((prev) => !prev);
                setIsNavMenuOpen(false);
              }}
              title="Aturan Meja (Waktu Giliran & Bot)"
              className="modern-glass-pill py-1.5 px-3 rounded-xl text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Aturan Meja</span>
            </button>

            {isTableSettingsOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-72 sm:w-80 modern-glass-panel p-3.5 rounded-2xl shadow-2xl space-y-3 z-50 animate-taunt-pop border border-white/15"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Menu */}
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-xs font-black text-amber-300 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-amber-400" />
                    <span>Aturan Meja Game</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold">
                      {isHost ? "Host Admin" : "Hanya Lihat"}
                    </span>
                    <button
                      onClick={() => setIsTableSettingsOpen(false)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 1. Waktu Giliran */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3 text-amber-400" /> Waktu Giliran:
                    </span>
                    <span className="font-mono text-amber-300 text-xs font-extrabold">
                      {currentTurnLimit === 0 ? "∞ Bebas" : `${currentTurnLimit} Detik`}
                    </span>
                  </div>

                  {isHost ? (
                    <div className="grid grid-cols-6 gap-1">
                      {[20, 30, 40, 50, 60, 0].map((dur) => (
                        <button
                          key={dur}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => onUpdateTurnLimit(dur)}
                          className={[
                            "py-1 rounded-xl text-[10px] font-black transition border text-center active:scale-95 cursor-pointer",
                            currentTurnLimit === dur
                              ? "bg-amber-400/25 border-amber-400 text-amber-200 ring-1 ring-amber-400 shadow font-black"
                              : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10",
                          ].join(" ")}
                        >
                          {dur === 0 ? "∞" : `${dur}s`}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">
                      Diatur oleh Host ({currentTurnLimit === 0 ? "Bebas" : `${currentTurnLimit}s`})
                    </div>
                  )}
                </div>

                {/* 2. Kesulitan Bot */}
                <div className="space-y-1 pt-1.5 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Swords className="w-3 h-3 text-amber-400" /> Tingkat Kesulitan Bot:
                    </span>
                    <span className="text-xs text-amber-300 font-extrabold capitalize">
                      {currentBotDiff === "hard"
                        ? "Pro"
                        : currentBotDiff === "easy"
                        ? "Santai"
                        : "Menengah"}
                    </span>
                  </div>

                  {isHost ? (
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: "easy", label: "Santai" },
                        { id: "medium", label: "Menengah" },
                        { id: "hard", label: "Pro" },
                      ].map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => {
                            soundEngine.playCardClick();
                            onUpdateBotDifficulty?.(lvl.id as BotDifficulty);
                          }}
                          className={[
                            "py-1 px-1 rounded-xl text-[10px] font-black transition border text-center active:scale-95 cursor-pointer",
                            currentBotDiff === lvl.id
                              ? "bg-amber-400/25 border-amber-400 text-amber-200 ring-1 ring-amber-400 shadow font-black"
                              : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10",
                          ].join(" ")}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">
                      Kecerdasan Bot diatur oleh Host
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <OrientationToggleBtn size="sm" />

          {/* Menu Hamburger Popover (Memuat Panduan Aturan, Audio & Keluar) */}
          <div className="relative" ref={navMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsNavMenuOpen((prev) => !prev);
                setIsTableSettingsOpen(false);
              }}
              title="Menu & Opsi Meja"
              className="modern-glass-pill py-1.5 px-3 rounded-xl text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
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
                className="absolute right-0 top-full mt-2 w-64 sm:w-72 modern-glass-panel p-3.5 rounded-2xl shadow-2xl space-y-3 z-50 animate-taunt-pop border border-white/15"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Menu */}
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-xs font-black text-amber-300 uppercase tracking-wider">
                  <span>Menu & Opsi</span>
                  <button
                    onClick={() => setIsNavMenuOpen(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Panduan Aturan Main */}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNavMenuOpen(false);
                      onOpenRules();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 hover:text-white transition flex items-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Panduan Aturan Main</span>
                  </button>
                </div>

                {/* Pengaturan Audio */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-black text-amber-300 uppercase tracking-wider">
                      <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Pengaturan Audio</span>
                    </span>
                  </div>

                  {/* BGM Toggle */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-200 font-bold">
                      <Music className="w-3.5 h-3.5 text-amber-400" /> Musik (BGM)
                    </span>
                    <button
                      type="button"
                      onClick={onToggleBgm}
                      className={[
                        "px-2.5 py-0.5 rounded-xl text-[10px] font-black transition border cursor-pointer",
                        bgmOn
                          ? "bg-amber-400 text-slate-950 border-amber-300 font-black shadow"
                          : "bg-white/5 border-white/10 text-slate-400 hover:text-white",
                      ].join(" ")}
                    >
                      {bgmOn ? "ON" : "OFF"}
                    </button>
                  </div>

                  {/* Volume Slider */}
                  {bgmOn && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                        <span>Volume Musik</span>
                        <span className="text-amber-300">{Math.round(bgmVolume * 100)}%</span>
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
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> Efek Suara (SFX)
                    </span>
                    <button
                      type="button"
                      onClick={onToggleSfx}
                      className={[
                        "px-2.5 py-0.5 rounded-xl text-[10px] font-black transition border cursor-pointer",
                        sfxOn
                          ? "bg-emerald-400 text-slate-950 border-emerald-300 font-black shadow"
                          : "bg-white/5 border-white/10 text-slate-400 hover:text-white",
                      ].join(" ")}
                    >
                      {sfxOn ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>

                {/* Keluar Meja */}
                <div className="pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNavMenuOpen(false);
                      onLeaveRoom();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-100 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Keluar dari Meja</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* 2. MAIN STAGE: 4 SPASIOUS PLAYER PODIUMS (1 BARIS PENUH)          */}
      {/* ================================================================= */}
      <main className="my-auto py-1 sm:py-2 flex-1 flex flex-col justify-center min-h-0 overflow-hidden">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 lg:gap-3.5 w-full h-full items-stretch">
          {[0, 1, 2, 3].map((slotIdx) => {
            const player = gameState.players[slotIdx];

            if (player) {
              const charProfile =
                CHARACTER_PROFILES[player.seatIndex % CHARACTER_PROFILES.length];
              const isMe = player.id === myPlayer?.id;
              const isSlotHost = player.id === gameState.hostId;
              const isMicActive = isMe
                ? voice.micEnabled
                : Boolean(voice.peerMicOn[player.id]);
              const isSpeaking = isMe
                ? Boolean(voice.peerSpeaking[myPlayer.id])
                : Boolean(voice.peerSpeaking[player.id]);
              const taunt = visibleTaunts[player.id];

              return (
                <div
                  key={player.id}
                  className={[
                    "relative flex flex-col justify-between modern-glass-panel rounded-xl sm:rounded-2xl p-1.5 sm:p-2 lg:p-3 transition-all duration-300 shadow-2xl overflow-hidden border min-h-[160px] sm:min-h-[220px] lg:min-h-[300px]",
                    isMe
                      ? "ring-2 ring-amber-400/90 shadow-[0_0_30px_rgba(245,158,11,0.3)] border-amber-400/50"
                      : player.isReady
                      ? "ring-1.5 ring-emerald-400/80 shadow-[0_0_25px_rgba(16,185,129,0.25)] border-emerald-400/40"
                      : "border-white/10",
                    isSpeaking
                      ? "ring-2 ring-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                      : "",
                  ].join(" ")}
                >
                  {/* Bubble Taunt */}
                  {taunt && (
                    <div className="absolute top-2 inset-x-2 z-30 animate-taunt-pop">
                      <div className="bg-slate-950/95 border border-amber-400 rounded-xl px-2 py-0.5 text-center shadow-lg">
                        <span className="text-[10px] sm:text-[11px] font-black text-amber-200 truncate block">
                          {taunt.text}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Header Slot: Nomor, Kamu Badge, Crown, Mic, Kick */}
                  <div className="flex items-center justify-between text-xs mb-0.5 sm:mb-1">
                    <div className="flex items-center gap-1 sm:gap-1.5 font-black text-slate-300 text-[10px] sm:text-xs">
                      <span className="text-white/60">#{slotIdx + 1}</span>
                      {isMe && (
                        <span className="text-[8px] sm:text-[9px] px-1.5 sm:px-2 py-0.2 rounded-full bg-amber-400/25 text-amber-300 border border-amber-400/50 font-black">
                          Kamu
                        </span>
                      )}
                      {isSlotHost && (
                        <span title="Host Meja" className="text-amber-400 inline-flex items-center">
                          <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-400" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Status Mic */}
                      <div
                        className={[
                          "p-0.5 sm:p-1 rounded-md sm:rounded-lg",
                          isMicActive
                            ? isSpeaking
                              ? "bg-emerald-500 text-slate-950 animate-pulse"
                              : "bg-emerald-950/80 text-emerald-400 border border-emerald-500/30"
                            : "bg-black/40 text-slate-500 border border-white/5",
                        ].join(" ")}
                        title={isMicActive ? "Mic Aktif" : "Mic Muted"}
                      >
                        {isMicActive ? (
                          <Mic className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        ) : (
                          <MicOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-400" />
                        )}
                      </div>

                      {/* Tombol Kick Lawan oleh Host */}
                      {isHost && !isMe && (
                        <button
                          type="button"
                          onClick={() => onRemovePlayer(player.id)}
                          title="Keluarkan dari Room"
                          className="p-0.5 sm:p-1 rounded-md sm:rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 3D Model Hero Stage dengan Pedestal Halus */}
                  <div className="relative w-full flex-1 min-h-[75px] sm:min-h-[120px] lg:min-h-[170px] flex items-center justify-center my-0.5 sm:my-1 rounded-xl bg-gradient-to-b from-white/[0.03] to-black/60 overflow-hidden border border-white/5">
                    <div className="hero-glow-pedestal bottom-1" />

                    <Model3DAvatar
                      modelPath={charProfile.modelPath}
                      className="w-full h-full"
                      focus="half"
                      autoRotate
                      facing="front"
                      isSpeaking={isSpeaking}
                      fallback={
                        <div
                          className={[
                            "w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br flex flex-col items-center justify-center border-2 shadow-xl",
                            charProfile.gradient,
                            charProfile.borderGlow,
                          ].join(" ")}
                        >
                          <span className="text-xl sm:text-2xl lg:text-3xl drop-shadow">{charProfile.icon}</span>
                          <span className="text-[9px] sm:text-[10px] font-black text-white uppercase tracking-wider">
                            {charProfile.heroName}
                          </span>
                        </div>
                      }
                    />

                    {/* Tombol Ganti Hero (< dan >) Langsung di Stage untuk Kamu */}
                    {isMe && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCycleHero("prev")}
                          title="Hero Sebelumnya"
                          className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center shadow-lg transition active:scale-90 z-20 cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCycleHero("next")}
                          title="Hero Selanjutnya"
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center shadow-lg transition active:scale-90 z-20 cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </>
                    )}

                    {/* Tag Nama Karakter Hero */}
                    <div className="absolute bottom-1 right-1 px-1 sm:px-1.5 py-0.2 rounded bg-black/75 border border-white/10 text-[8px] sm:text-[9px] font-bold text-amber-300 flex items-center gap-0.5 sm:gap-1 pointer-events-none">
                      <span>{charProfile.icon}</span>
                      <span className="hidden xs:inline sm:inline">{charProfile.heroName}</span>
                    </div>
                  </div>

                  {/* Kustomisasi Cepat Karakter untuk Kamu (4 Pill Mini Hero) */}
                  {isMe && (
                    <div className="grid grid-cols-4 gap-0.5 sm:gap-1 my-0.5 sm:my-1">
                      {CHARACTER_PROFILES.map((char, cIdx) => {
                        const isSelected =
                          (myPlayer.seatIndex % CHARACTER_PROFILES.length) === cIdx;
                        return (
                          <button
                            key={char.heroName}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => onSaveProfile(undefined, cIdx)}
                            title={`Pilih ${char.heroName}`}
                            className={[
                              "py-0.5 rounded-md sm:rounded-lg border text-center transition flex items-center justify-center text-[10px] sm:text-xs active:scale-95 cursor-pointer",
                              isSelected
                                ? "bg-amber-400 text-slate-950 border-amber-300 font-black shadow"
                                : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-400",
                            ].join(" ")}
                          >
                            <span>{char.icon}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Nama Player & Pengeditan Nama */}
                  <div className="space-y-0.5 sm:space-y-1 pt-0.5 sm:pt-1 text-center">
                    {isMe ? (
                      <div className="flex items-center gap-0.5 sm:gap-1 bg-black/40 border border-white/10 rounded-lg sm:rounded-xl p-0.5">
                        <input
                          type="text"
                          maxLength={14}
                          value={editingName}
                          onChange={(e) => {
                            setEditingName(e.target.value);
                            setIsEditingActive(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") onSaveProfile(editingName);
                          }}
                          placeholder="Nama kamu..."
                          className="flex-1 bg-transparent px-1 sm:px-2 py-0.5 text-[10px] sm:text-xs text-amber-200 font-bold focus:outline-none min-w-0"
                        />
                        <button
                          type="button"
                          onClick={handleRandomizeName}
                          title="Acak Nama Keren"
                          className="p-0.5 sm:p-1 rounded-md sm:rounded-lg hover:bg-white/10 text-amber-300 transition shrink-0 cursor-pointer"
                        >
                          <Dices className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </button>
                        {editingName.trim() !== myPlayer.name && (
                          <button
                            type="button"
                            disabled={isSubmitting || !editingName.trim()}
                            onClick={() => onSaveProfile(editingName)}
                            title="Simpan Nama"
                            className="p-0.5 sm:p-1 rounded-md sm:rounded-lg bg-emerald-500 text-slate-950 transition shrink-0 cursor-pointer"
                          >
                            <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="font-extrabold text-[10px] sm:text-xs lg:text-sm text-slate-100 truncate px-0.5">
                        {player.name}
                      </div>
                    )}

                    {/* Badge Status Kesiapan (Ready / Bot) */}
                    <div>
                      {player.isBot ? (
                        <span className="inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black bg-sky-950/80 border border-sky-400/50 text-sky-300">
                          Bot ({currentBotDiff})
                        </span>
                      ) : player.isReady ? (
                        <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse">
                          <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" /> SIAP
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold bg-white/5 border border-white/10 text-slate-400">
                          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" /> Belum Siap
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            {/* SLOT KOSONG */}
            return (
              <div
                key={`empty-slot-${slotIdx}`}
                className="flex flex-col items-center justify-center p-1.5 sm:p-2.5 lg:p-3 rounded-xl sm:rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.015] text-center min-h-[160px] sm:min-h-[220px] lg:min-h-[300px] transition hover:border-white/20"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-1 sm:mb-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-slate-400" />
                </div>

                <span className="text-[10px] sm:text-xs font-bold text-slate-400 mb-0.5 sm:mb-1">
                  Slot #{slotIdx + 1} Kosong
                </span>

                {isHost ? (
                  <button
                    type="button"
                    onClick={onAddBot}
                    disabled={isSubmitting}
                    className="mt-1 sm:mt-2 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white/[0.04] hover:bg-amber-400/20 border border-amber-400/40 hover:border-amber-400/80 text-amber-300 hover:text-amber-200 text-[9px] sm:text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                    <span>+ Tambah Bot</span>
                  </button>
                ) : (
                  <span className="text-[8px] sm:text-[10px] text-slate-500 italic mt-0.5">
                    Menunggu teman...
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* ================================================================= */}
      {/* 3. BOTTOM ACTION DOCK: CHAT, MIC, STATUS READY & MULAI GAME        */}
      {/* ================================================================= */}
      <footer className="relative z-20 modern-glass-panel rounded-xl sm:rounded-2xl px-2 sm:px-4 py-1.5 sm:py-2 border border-white/10 shadow-2xl flex items-center justify-between gap-1.5 sm:gap-2 shrink-0">
        {/* Sisi Kiri: Komunikasi (Chat, Mic, Headset) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Tombol Chat */}
          <button
            type="button"
            onClick={onOpenChat}
            title="Buka Chat Meja"
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 shadow text-slate-200 hover:text-white font-bold text-xs transition active:scale-95 cursor-pointer"
          >
            <MessageSquareMore className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
            <span>Chat</span>
          </button>

          {/* Tombol Mikrofon */}
          <button
            type="button"
            onClick={voice.toggleMic}
            disabled={voice.isConnectingMic}
            title={voice.micEnabled ? "Matikan Mikrofon" : "Nyalakan Mikrofon"}
            className={[
              "flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border font-bold text-xs transition shadow active:scale-95 cursor-pointer",
              voice.micEnabled
                ? voice.peerSpeaking[myPlayer?.id || ""]
                  ? "bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                  : "bg-emerald-950/60 hover:bg-emerald-900/60 border-emerald-500/40 text-emerald-300"
                : "bg-white/[0.05] hover:bg-white/10 border-white/10 text-slate-300",
            ].join(" ")}
          >
            {voice.isConnectingMic ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-amber-300" />
            ) : voice.micEnabled ? (
              <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" />
            ) : (
              <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
            )}
            <span className="hidden xs:inline sm:inline">{voice.micEnabled ? "Mic On" : "Mic Off"}</span>
          </button>

          {/* Tombol Speaker Suara Teman */}
          <button
            type="button"
            onClick={voice.toggleSpeaker}
            title={voice.speakerEnabled ? "Bisukan Suara Teman" : "Nyalakan Suara Teman"}
            className={[
              "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl border font-bold text-xs transition shadow active:scale-95 cursor-pointer",
              voice.speakerEnabled
                ? "bg-white/[0.05] hover:bg-white/10 border-white/10 text-slate-200"
                : "bg-rose-950/60 border-rose-500/40 text-rose-300",
            ].join(" ")}
          >
            {voice.speakerEnabled ? (
              <Headphones className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
            <span className="hidden sm:inline">
              {voice.speakerEnabled ? "Audio On" : "Audio Mute"}
            </span>
          </button>
        </div>

        {/* Bagian Tengah: Status Kesiapan Ruangan */}
        <div className="hidden lg:block text-center">
          {gameState.players.length < 2 ? (
            <span className="text-xs font-semibold text-amber-300">
              Butuh minimal 2 pemain untuk memulai meja (tambah Bot atau undang teman).
            </span>
          ) : !allHumansReady ? (
            <span className="text-xs font-semibold text-amber-300">
              Menunggu kesiapan pemain ({readyHumanCount}/{humanPlayers.length} Siap)
            </span>
          ) : (
            <span className="text-xs font-black text-emerald-400">
              Semua pemain sudah SIAP ({readyHumanCount}/{humanPlayers.length})!
            </span>
          )}
        </div>

        {/* Sisi Kanan: Tombol SIAP & MULAI GAME */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          {/* Tombol Ready */}
          {myPlayer && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onToggleReady}
              className={[
                "flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black shadow-lg transition active:scale-95 cursor-pointer",
                myPlayer.isReady
                  ? "bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-400/50"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)]",
              ].join(" ")}
            >
              {myPlayer.isReady ? (
                <>
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Batal Siap</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                  <span>SAYA SIAP!</span>
                </>
              )}
            </button>
          )}

          {/* Tombol Mulai Game (Khusus Host) */}
          {isHost && (
            <button
              type="button"
              onClick={onStartGame}
              disabled={!canStart || isSubmitting}
              className="flex items-center gap-1 sm:gap-1.5 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 disabled:opacity-35 text-slate-950 font-black text-[11px] sm:text-xs shadow-[0_0_20px_rgba(245,158,11,0.35)] transition active:scale-95 disabled:pointer-events-none cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
              <span>MULAI GAME</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
