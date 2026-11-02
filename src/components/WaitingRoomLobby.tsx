"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Check,
  Clock,
  Copy,
  Crown,
  Headphones,
  Link2,
  Loader2,
  LogOut,
  MessageSquareMore,
  Mic,
  MicOff,
  Music,
  Play,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { GameState, PlayerState, TauntEvent } from "@/lib/game/types";
import { CHARACTER_PROFILES } from "./PlayerSeat3D";
import OrientationToggleBtn from "./OrientationToggleBtn";

const Model3DAvatar = dynamic(() => import("./Model3DAvatar"), {
  ssr: false,
});

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

  useEffect(() => {
    if (myPlayer?.name && !isEditingActive) {
      setEditingName(myPlayer.name);
    }
  }, [myPlayer?.name, isEditingActive]);

  const humanPlayers = gameState.players.filter((p) => !p.isBot);
  const readyHumanCount = humanPlayers.filter((p) => p.isReady).length;
  const allHumansReady =
    humanPlayers.length > 0 && readyHumanCount === humanPlayers.length;
  const canStart = gameState.players.length >= 2 && allHumansReady;

  return (
    <div className="relative z-30 w-full min-h-full flex flex-col justify-between p-1.5 sm:p-3 lg:p-4 text-white max-w-7xl mx-auto select-none pb-14 sm:pb-6 safe-top-inset">
      {/* ================================================================= */}
      {/* 1. TOP BAR: LOGO POKER BARUDAK, ROOM, SUARA, ATURAN & KELUAR      */}
      {/* ================================================================= */}
      <header className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-3 bg-slate-950/85 border border-amber-400/40 rounded-2xl px-2.5 sm:px-4 py-1.5 sm:py-2 backdrop-blur-md shadow-xl">
        {/* Sisi Kiri: Logo Resmi Poker Barudak & Kode Room */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Poker Barudak"
              className="h-8 sm:h-10 w-auto object-contain drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)] select-none"
            />
            <div className="hidden xs:block sm:block">
              <h1 className="text-xs sm:text-sm font-black tracking-wider text-amber-300 uppercase leading-none">
                POKER BARUDAK
              </h1>
              <p className="text-[8px] sm:text-[9px] text-slate-400 font-semibold mt-0.5">
                Waiting Room Lobby
              </p>
            </div>
          </div>

          <div className="h-5 sm:h-6 w-px bg-slate-800 hidden sm:block" />

          {/* Chip Kode Room & Tombol Undang */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-900 border border-amber-400/30 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl">
            <span className="text-[10px] text-slate-400 font-bold hidden md:inline">
              Room:
            </span>
            <span className="font-mono font-black text-amber-300 text-xs sm:text-sm tracking-wider">
              #{gameState.roomCode}
            </span>

            <button
              type="button"
              onClick={onCopyCode}
              title="Salin Kode Room"
              className="p-1 rounded-lg hover:bg-slate-800 text-amber-300 transition"
            >
              {copiedCode ? (
                <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onShareInvite}
              title="Salin Link Meja untuk Teman"
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[9px] sm:text-[10px] shadow transition ml-0.5"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3 h-3 text-white" />
                  <span className="text-white hidden sm:inline">Tersalin!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Undang Teman</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sisi Kanan: Audio, Panduan Aturan & Tombol Keluar Meja */}
        <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
          {/* Toggle BGM */}
          <button
            type="button"
            onClick={onToggleBgm}
            title={bgmOn ? "Musik Menyala" : "Musik Mati"}
            className={[
              "p-1.5 sm:px-2 sm:py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition",
              bgmOn
                ? "bg-amber-500/20 border-amber-400/50 text-amber-300"
                : "bg-slate-900 border-slate-800 text-slate-500",
            ].join(" ")}
          >
            <Music className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden md:inline">{bgmOn ? "BGM On" : "BGM Off"}</span>
          </button>

          {/* Toggle SFX */}
          <button
            type="button"
            onClick={onToggleSfx}
            title={sfxOn ? "Efek Suara Menyala" : "Efek Suara Mati"}
            className={[
              "p-1.5 sm:px-2 sm:py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition",
              sfxOn
                ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                : "bg-slate-900 border-slate-800 text-slate-500",
            ].join(" ")}
          >
            {sfxOn ? (
              <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            ) : (
              <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            )}
            <span className="hidden md:inline">{sfxOn ? "SFX On" : "SFX Off"}</span>
          </button>

          {/* Mode Vertikal / Horizontal (Layar Penuh) */}
          <OrientationToggleBtn size="sm" />

          {/* Panduan Aturan */}
          <button
            type="button"
            onClick={onOpenRules}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-[10px] sm:text-xs font-bold text-emerald-300 transition"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Aturan</span>
          </button>

          {/* Keluar Meja */}
          <button
            type="button"
            onClick={onLeaveRoom}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-rose-950/90 hover:bg-rose-900 border border-rose-500/50 text-[10px] sm:text-xs font-bold text-rose-200 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* 2. MAIN LOBBY: 4 SLOT PEMAIN (RESPONSIF HP LANDSCAPE & PORTRAIT)  */}
      {/* ================================================================= */}
      <main className="my-1.5 sm:my-2.5 space-y-2 sm:space-y-2.5 flex-1 flex flex-col justify-center">
        {/* Grid 4 Kursi / Slot Pemain (2 col di HP portrait, 4 col di HP landscape & desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2.5">
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
                    "relative flex flex-col justify-between bg-slate-950/85 border-2 rounded-2xl p-1.5 sm:p-2.5 transition shadow-lg overflow-hidden backdrop-blur-md",
                    isMe
                      ? "border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                      : player.isReady
                      ? "border-emerald-500/70"
                      : "border-slate-800",
                    isSpeaking
                      ? "ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                      : "",
                  ].join(" ")}
                >
                  {/* Bubble Taunt / Chat Pesan */}
                  {taunt && (
                    <div className="absolute top-1 inset-x-2 z-30 animate-taunt-pop">
                      <div className="bg-slate-950/95 border border-amber-400 rounded-xl px-2 py-0.5 sm:py-1 text-center shadow-lg">
                        <span className="text-[10px] sm:text-xs font-black text-amber-200 truncate block">
                          {taunt.text}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Header Slot: Nomor, Host Crown, & Tombol Kick (Hanya Host) */}
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] mb-0.5 sm:mb-1">
                    <div className="flex items-center gap-1 font-extrabold text-slate-300">
                      <span>#{slotIdx + 1}</span>
                      {isMe && (
                        <span className="text-[8px] sm:text-[9px] text-amber-300 font-black">
                          (Kamu)
                        </span>
                      )}
                      {isSlotHost && (
                        <span
                          title="Pembuat Room (Host)"
                          className="text-amber-400 text-xs inline-flex items-center gap-0.5"
                        >
                          <Crown className="w-3 h-3 fill-amber-400" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Status Mic */}
                      <div
                        className={[
                          "p-0.5 rounded-md",
                          isMicActive
                            ? isSpeaking
                              ? "bg-emerald-500 text-slate-950 animate-pulse"
                              : "bg-emerald-950 text-emerald-400"
                            : "bg-slate-900 text-slate-500",
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
                          className="text-slate-400 hover:text-rose-400 transition ml-0.5"
                        >
                          <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Avatar 3D Model Hero (Ukuran dinamis agar muat di layar HP) */}
                  <div className="relative w-full h-20 sm:h-24 lg:h-32 flex items-center justify-center my-0.5 sm:my-1 rounded-xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 overflow-hidden border border-slate-800/80">
                    <Model3DAvatar
                      modelPath={charProfile.modelPath}
                      className="w-full h-full"
                      focus="half"
                      autoRotate
                      facing="front"
                      isSpeaking={isSpeaking}
                    />

                    {/* Tag Nama Karakter Hero di Pojok Bawah Avatar */}
                    <div className="absolute bottom-1 right-1 px-1 sm:px-1.5 py-0.5 rounded-md bg-slate-950/80 border border-slate-700/60 text-[8px] sm:text-[9px] font-bold text-amber-300 flex items-center gap-0.5 sm:gap-1 pointer-events-none">
                      <span>{charProfile.icon}</span>
                      <span className="truncate max-w-[60px] sm:max-w-none">{charProfile.heroName}</span>
                    </div>
                  </div>

                  {/* Nama Player & Status Kesiapan (Ready Badge) */}
                  <div className="space-y-1 pt-0.5 sm:pt-1 text-center">
                    <div className="font-extrabold text-[11px] sm:text-xs lg:text-sm text-slate-100 truncate px-1">
                      {player.name}
                    </div>

                    <div>
                      {player.isBot ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold bg-sky-950 border border-sky-500/50 text-sky-300">
                          🤖 Bot
                        </span>
                      ) : player.isReady ? (
                        <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black bg-emerald-950 border border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse">
                          <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> SIAP
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300">
                          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Belum Siap
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
                className="flex flex-col items-center justify-center p-2 sm:p-3 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40 text-center min-h-[130px] sm:min-h-[170px] lg:min-h-[200px] transition hover:border-slate-700"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-1 sm:mb-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>

                <span className="text-[10px] sm:text-xs font-bold text-slate-400">
                  Slot #{slotIdx + 1} Kosong
                </span>

                {isHost ? (
                  <button
                    type="button"
                    onClick={onAddBot}
                    disabled={isSubmitting}
                    className="mt-2 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-400/40 text-[9px] sm:text-[10px] font-bold text-amber-300 transition shadow"
                  >
                    <UserPlus className="w-3 h-3" />+ Tambah Bot
                  </button>
                ) : (
                  <span className="text-[9px] text-slate-500 italic mt-0.5">
                    Menunggu teman...
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ================================================================= */}
        {/* 3. PENGATURAN PROFIL ANDA & WAKTU GILIRAN (2 PANEL HORIZONTAL)    */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2.5">
          {/* Panel Kiri: Profil Kamu di Meja (Ubah Nama & Karakter 3D) */}
          {myPlayer && (
            <div className="bg-slate-950/85 border border-amber-400/40 rounded-2xl p-2 sm:p-2.5 text-left space-y-1.5 backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between text-[11px] sm:text-xs">
                <span className="flex items-center gap-1.5 font-black text-amber-300">
                  <User className="w-3.5 h-3.5" /> Profil Kamu di Meja
                </span>
                <span className="text-[9px] text-slate-400">
                  Ubah nama & avatar hero 3D
                </span>
              </div>

              {/* Form Input Ganti Nama */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  maxLength={15}
                  value={editingName}
                  onChange={(e) => {
                    setEditingName(e.target.value);
                    setIsEditingActive(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onSaveProfile(editingName);
                    }
                  }}
                  placeholder="Ketik nama kamu..."
                  className="flex-1 bg-slate-900 border border-amber-400/40 rounded-xl px-2.5 py-1 text-xs text-amber-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-300 shadow-inner"
                />
                <button
                  type="button"
                  disabled={
                    isSubmitting ||
                    !editingName.trim() ||
                    editingName.trim() === myPlayer.name
                  }
                  onClick={() => onSaveProfile(editingName)}
                  className="px-3 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-30 text-slate-950 text-xs font-black transition flex items-center gap-1 shrink-0 shadow"
                >
                  <Check className="w-3 h-3" />
                  <span>Simpan</span>
                </button>
              </div>

              {/* Pilihan 4 Avatar Karakter 3D */}
              <div>
                <div className="text-[9px] sm:text-[10px] text-slate-300 font-bold mb-1">
                  Pilih Hero Avatar 3D:
                </div>
                <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                  {CHARACTER_PROFILES.map((char, cIdx) => {
                    const isSelected =
                      (myPlayer.seatIndex % CHARACTER_PROFILES.length) === cIdx;
                    return (
                      <button
                        key={char.heroName}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => onSaveProfile(undefined, cIdx)}
                        className={[
                          "flex items-center justify-center gap-1 py-1 px-1 rounded-xl border transition text-center shadow",
                          isSelected
                            ? "bg-amber-400/25 border-amber-300 shadow-md ring-1 ring-amber-300 text-amber-200 font-extrabold"
                            : "bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-400",
                        ].join(" ")}
                      >
                        <span className="text-sm sm:text-base leading-none">{char.icon}</span>
                        <span className="text-[9px] sm:text-[10px] font-bold truncate">
                          {char.heroName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Panel Kanan: Pengaturan Batas Waktu Giliran */}
          <div className="bg-slate-950/85 border border-amber-400/40 rounded-2xl p-2 sm:p-2.5 text-left space-y-1.5 backdrop-blur-md shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[11px] sm:text-xs">
                <span className="flex items-center gap-1.5 font-black text-amber-300">
                  <Clock className="w-3.5 h-3.5" /> Batas Waktu Giliran
                </span>
                <span className="font-mono font-extrabold text-amber-200 text-xs">
                  {(gameState.turnDurationLimit ?? 20) === 0
                    ? "∞ Unlimited (Bebas)"
                    : `${gameState.turnDurationLimit ?? 20} Detik`}
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">
                {isHost
                  ? "Atur durasi giliran tiap pemain saat pertandingan berlangsung:"
                  : "Durasi giliran ditentukan oleh Pembuat Meja (Host)."}
              </p>
            </div>

            {isHost ? (
              <div className="grid grid-cols-6 gap-1 pt-0.5 sm:pt-1">
                {[20, 30, 40, 50, 60, 0].map((dur) => {
                  const isSelected =
                    (gameState.turnDurationLimit ?? 20) === dur;
                  return (
                    <button
                      key={dur}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => onUpdateTurnLimit(dur)}
                      className={[
                        "py-1 sm:py-1.5 rounded-xl text-[9px] sm:text-[10px] font-black transition border text-center shadow",
                        isSelected
                          ? "bg-amber-400 text-slate-950 border-amber-300 shadow-md font-extrabold scale-105"
                          : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800",
                      ].join(" ")}
                    >
                      {dur === 0 ? "∞ Bebas" : `${dur}s`}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[10px] sm:text-[11px] font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {(gameState.turnDurationLimit ?? 20) === 0
                    ? "Bebas tanpa batas waktu (Unlimited)"
                    : `${gameState.turnDurationLimit ?? 20} detik per langkah`}
                </span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ================================================================= */}
      {/* 4. BOTTOM BAR: KONTROL KOMUNIKASI (CHAT, MIC, HEADSET) & READY    */}
      {/* ================================================================= */}
      <footer className="bg-slate-950/90 border border-amber-400/40 rounded-2xl px-2.5 sm:px-4 py-2 backdrop-blur-md shadow-2xl flex flex-wrap items-center justify-between gap-2">
        {/* Sisi Kiri: Komunikasi (Chat, Mic, Headset) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Tombol Chat (Diubah menjadi 'Chat' sesuai permintaan user) */}
          <button
            type="button"
            onClick={onOpenChat}
            title="Buka Chat Meja"
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 border border-purple-400/60 shadow-lg text-amber-300 font-extrabold text-[10px] sm:text-xs transition active:scale-95"
          >
            <MessageSquareMore className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Chat</span>
          </button>

          {/* Tombol Mikrofon (Voice Chat) */}
          <button
            type="button"
            onClick={voice.toggleMic}
            disabled={voice.isConnectingMic}
            title={
              voice.micEnabled
                ? "Matikan Mikrofon (Mute)"
                : "Nyalakan Mikrofon untuk Ngobrol"
            }
            className={[
              "flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border font-extrabold text-[10px] sm:text-xs transition shadow-lg active:scale-95",
              voice.micEnabled
                ? voice.peerSpeaking[myPlayer?.id || ""]
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-200 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.8)] scale-105"
                  : "bg-emerald-950 hover:bg-emerald-900 border-emerald-400 text-emerald-300"
                : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300",
            ].join(" ")}
          >
            {voice.isConnectingMic ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-amber-300" />
            ) : voice.micEnabled ? (
              <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" />
            ) : (
              <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
            )}
            <span>{voice.micEnabled ? "Mic On" : "Mic Off"}</span>
          </button>

          {/* Tombol Headset / Speaker Suara Teman */}
          <button
            type="button"
            onClick={voice.toggleSpeaker}
            title={
              voice.speakerEnabled
                ? "Bisukan Suara Obrolan Teman"
                : "Nyalakan Suara Obrolan Teman"
            }
            className={[
              "flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border font-extrabold text-[10px] sm:text-xs transition shadow-lg active:scale-95",
              voice.speakerEnabled
                ? "bg-slate-900 hover:bg-slate-800 border-slate-700 text-amber-300"
                : "bg-rose-950 border-rose-500/60 text-rose-300",
            ].join(" ")}
          >
            {voice.speakerEnabled ? (
              <Headphones className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
            <span className="hidden xs:inline sm:inline">
              {voice.speakerEnabled ? "Audio On" : "Audio Mute"}
            </span>
          </button>
        </div>

        {/* Bagian Tengah: Status Kesiapan Ruangan (sembunyi di layar sangat sempit agar tombol muat) */}
        <div className="hidden lg:block text-center">
          {gameState.players.length < 2 ? (
            <span className="text-xs font-semibold text-amber-300">
              ⚠️ Butuh minimal 2 pemain untuk memulai (tambah Bot atau bagikan link).
            </span>
          ) : !allHumansReady ? (
            <span className="text-xs font-semibold text-amber-300">
              ⏳ Menunggu semua pemain menekan Siap ({readyHumanCount}/{humanPlayers.length} Siap)
            </span>
          ) : (
            <span className="text-xs font-extrabold text-emerald-400">
              ✅ Semua pemain sudah SIAP ({readyHumanCount}/{humanPlayers.length})!
            </span>
          )}
        </div>

        {/* Sisi Kanan: Tombol SAYA SIAP & MULAI GAME */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          {/* Tombol Ready Setiap Pemain */}
          {myPlayer && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onToggleReady}
              className={[
                "flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black shadow-xl transition active:scale-95",
                myPlayer.isReady
                  ? "bg-slate-900 hover:bg-slate-800 text-amber-300 border-2 border-amber-400/50"
                  : "bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.6)] animate-pulse",
              ].join(" ")}
            >
              {myPlayer.isReady ? (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  <span>Batal Siap</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>SAYA SIAP! (READY)</span>
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
              className="flex items-center gap-1.5 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-35 text-slate-950 font-black text-[11px] sm:text-xs shadow-xl transition active:scale-95 disabled:pointer-events-none"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>MULAI GAME</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
