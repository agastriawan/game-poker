"use client";

import React from "react";
import { Mic, MicOff } from "lucide-react";
import { PlayerState, TauntEvent } from "@/lib/game/types";

interface PlayerSeat3DProps {
  player: PlayerState;
  position: "top" | "left" | "right" | "bottom";
  isCurrentTurn: boolean;
  activeTaunt?: TauntEvent | null;
  onDismissTaunt?: () => void;
  isMe?: boolean;
  customAvatarIdx?: number;
  isMicOn?: boolean;
  isSpeaking?: boolean;
  turnSecondsLeft?: number | null;
}

export const CHARACTER_PROFILES = [
  {
    id: 0,
    title: "Ratu Kasino",
    quote: "Siap banting kombo maut! ✨",
    gradient: "from-fuchsia-600 via-purple-700 to-indigo-900",
    borderGlow: "border-fuchsia-400/70",
    hairColor: "#e879f9",
    outfitColor: "#311042",
  },
  {
    id: 1,
    title: "Raja Bluffing",
    quote: "3 Sekop di tangan, semua minggir! ♠️",
    gradient: "from-cyan-500 via-blue-700 to-slate-900",
    borderGlow: "border-cyan-400/70",
    hairColor: "#38bdf8",
    outfitColor: "#0f2942",
  },
  {
    id: 2,
    title: "Master Bom",
    quote: "Jangan berani buang 1 Poker! 💣",
    gradient: "from-amber-500 via-rose-600 to-purple-950",
    borderGlow: "border-amber-400/70",
    hairColor: "#fbbf24",
    outfitColor: "#451a03",
  },
  {
    id: 3,
    title: "Sultan Sekop",
    quote: "Main santai tapi pasti Juara 1! 👑",
    gradient: "from-emerald-500 via-teal-700 to-slate-950",
    borderGlow: "border-emerald-400/70",
    hairColor: "#34d399",
    outfitColor: "#064e3b",
  },
];

export default function PlayerSeat3D({
  player,
  position,
  isCurrentTurn,
  activeTaunt,
  onDismissTaunt,
  isMe = false,
  customAvatarIdx,
  isMicOn = false,
  isSpeaking = false,
  turnSecondsLeft = null,
}: PlayerSeat3DProps) {
  const profileIdx =
    typeof customAvatarIdx === "number"
      ? customAvatarIdx % CHARACTER_PROFILES.length
      : player.seatIndex % CHARACTER_PROFILES.length;
  const charProfile = CHARACTER_PROFILES[profileIdx];

  const fanCount = Math.min(player.hand.length, 4);

  return (
    <div
      className={[
        "relative flex items-center select-none group",
        isMe ? "flex-row gap-2" : "flex-col",
      ].join(" ")}
    >
      {/* BALON EMOT / EJEKAN (HANYA EJEKAN KITA SENDIRI YANG BISA DI-CLOSE, LAWAN HILANG OTOMATIS 10 DETIK) */}
      {activeTaunt && (
        <div
          key={activeTaunt.id}
          onClick={isMe ? onDismissTaunt : undefined}
          title={isMe ? "Klik untuk menutup ejekanmu" : undefined}
          className={[
            "absolute z-50 min-w-[150px] max-w-[215px] px-2.5 py-1.5 rounded-2xl bg-gradient-to-br from-white via-amber-50 to-amber-100 text-slate-950 border-2 border-amber-400 shadow-[0_10px_25px_rgba(0,0,0,0.85)] animate-taunt-pop",
            isMe ? "cursor-pointer" : "pointer-events-none",
            isMe
              ? "-top-[116px] left-0"
              : position === "top"
              ? "top-1 left-full ml-2"
              : position === "left"
              ? "-top-12 left-0"
              : "-top-12 right-0",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-lg sm:text-xl leading-none drop-shadow">
                {activeTaunt.emoji}
              </span>
              <div className="text-left leading-tight">
                <div className="text-[8px] font-extrabold uppercase tracking-wider text-purple-700 truncate max-w-[125px]">
                  {player.name}
                </div>
                <div className="text-[10px] sm:text-[11px] font-black text-slate-900 break-words max-w-[145px]">
                  &ldquo;{activeTaunt.text}&rdquo;
                </div>
              </div>
            </div>
            {isMe && (
              <span className="text-[10px] font-black text-slate-400 hover:text-rose-600 px-0.5 leading-none">
                ✕
              </span>
            )}
          </div>
        </div>
      )}

      {/* AVATAR KARAKTER COMPACT */}
      <div className="relative flex items-center justify-center shrink-0">
        {isSpeaking ? (
          <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-green-300 to-teal-400 opacity-90 blur-sm animate-pulse" />
        ) : isCurrentTurn ? (
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-500 opacity-85 blur-sm animate-pulse" />
        ) : null}

        <div
          className={[
            "relative rounded-xl sm:rounded-2xl overflow-hidden border-2 shadow-[0_6px_14px_rgba(0,0,0,0.75)] transition-transform duration-300 animate-float-char bg-gradient-to-b",
            isMe
              ? "w-10 h-10 sm:w-11 sm:h-11"
              : "w-11 h-11 sm:w-14 sm:h-14",
            charProfile.gradient,
            isSpeaking
              ? "border-emerald-300 scale-105 ring-2 ring-emerald-400"
              : isCurrentTurn
              ? "border-amber-300 scale-105 ring-2 ring-amber-400"
              : charProfile.borderGlow,
          ].join(" ")}
        >
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full drop-shadow-[0_3px_5px_rgba(0,0,0,0.5)]"
          >
            <circle cx="50" cy="45" r="38" fill="rgba(255,255,255,0.12)" />
            <path
              d="M22 45 C18 75, 25 92, 50 92 C75 92, 82 75, 78 45 Z"
              fill={charProfile.hairColor}
              opacity="0.85"
            />
            <path
              d="M20 98 C22 74, 35 68, 50 68 C65 68, 78 74, 80 98 Z"
              fill={charProfile.outfitColor}
            />
            <polygon points="42,68 50,82 58,68" fill="#ffffff" />
            <polygon points="46,74 54,74 50,85" fill="#f59e0b" />
            <ellipse cx="50" cy="46" rx="19" ry="21" fill="#fde6d8" />
            <ellipse cx="42" cy="47" rx="3.2" ry="4.2" fill="#1e1b4b" />
            <ellipse cx="58" cy="47" rx="3.2" ry="4.2" fill="#1e1b4b" />
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
              fill={charProfile.hairColor}
            />
            <polygon
              points="38,23 44,14 50,20 56,14 62,23"
              fill="#fbbf24"
              stroke="#78350f"
              strokeWidth="1.2"
            />
          </svg>
        </div>

        {/* TUMPUKAN KARTU RAPI DI TANGAN LAWAN */}
        {!isMe && player.hand.length > 0 && (
          <div
            className={[
              "absolute -bottom-1 flex items-center justify-center",
              position === "left" ? "-right-6" : "-left-6",
            ].join(" ")}
          >
            <div className="relative flex items-center">
              {Array.from({ length: fanCount }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-3.5 h-5 sm:w-4 sm:h-6 -ml-2.5 first:ml-0 rounded bg-gradient-to-br from-amber-400 via-red-700 to-slate-950 border border-amber-300 shadow"
                />
              ))}
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-950/95 border border-amber-400 text-amber-300 font-black text-[9px] sm:text-[10px] shadow">
                {player.hand.length}
              </span>
            </div>
          </div>
        )}

        {/* BADGE STATUS MIC (UNTUK PEMAIN MANUSIA) */}
        {!player.isBot && (
          <div
            className={[
              "absolute -top-1.5 -left-1.5 w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full flex items-center justify-center border shadow",
              isSpeaking
                ? "bg-emerald-400 border-white text-slate-950 animate-bounce"
                : isMicOn
                ? "bg-emerald-950/95 border-emerald-400 text-emerald-300"
                : "bg-slate-950/90 border-slate-700 text-slate-500",
            ].join(" ")}
            title={
              isSpeaking
                ? "Sedang berbicara"
                : isMicOn
                ? "Mic Aktif"
                : "Mic Mati"
            }
          >
            {isMicOn ? (
              <Mic className="w-2.5 h-2.5" />
            ) : (
              <MicOff className="w-2.5 h-2.5" />
            )}
          </div>
        )}

        {/* BADGE STATUS */}
        {player.finishRank !== null ? (
          <div className="absolute -top-2 -right-2 px-1.5 py-0.2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-[9px] shadow border border-white">
            🏆 #{player.finishRank}
          </div>
        ) : isCurrentTurn ? (
          <div
            className={[
              "absolute -top-2 -right-2 px-1.5 py-0.2 rounded-full font-black text-[9px] shadow animate-bounce border",
              typeof turnSecondsLeft === "number" && turnSecondsLeft <= 5
                ? "bg-gradient-to-r from-rose-500 to-red-600 text-white border-rose-200"
                : "bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 border-emerald-100",
            ].join(" ")}
          >
            {typeof turnSecondsLeft === "number"
              ? `⏱️ ${turnSecondsLeft}s`
              : "⚡ JALAN"}
          </div>
        ) : player.hasPassedThisTrick ? (
          <div className="absolute -top-2 -right-2 px-1.5 py-0.2 rounded-full bg-slate-900/95 border border-rose-500/60 text-rose-300 font-black text-[9px] uppercase">
            PASS
          </div>
        ) : null}
      </div>

      {/* NAMEPLATE COMPACT: HANYA NAMA & POINTS DI BAWAHNYA */}
      <div
        className={[
          "px-2.5 py-1 rounded-xl bg-slate-950/95 border border-amber-400/40 shadow-md flex flex-col justify-center",
          isMe ? "mt-0 items-start" : "mt-1 items-center",
        ].join(" ")}
      >
        <span className="text-[11px] sm:text-xs font-black text-white truncate max-w-[95px] leading-tight">
          {player.name}
        </span>
        <span
          className={[
            "mt-0.5 text-[9px] sm:text-[10px] font-mono font-extrabold px-1.5 py-0.1 rounded leading-tight",
            player.totalScore > 0
              ? "bg-emerald-950 text-emerald-300"
              : player.totalScore < 0
              ? "bg-rose-950 text-rose-300"
              : "bg-slate-800 text-amber-300",
          ].join(" ")}
        >
          {player.totalScore > 0
            ? `+${player.totalScore}`
            : player.totalScore}{" "}
          pts
        </span>
      </div>
    </div>
  );
}
