"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Crown, Mic, MicOff } from "lucide-react";
import { PlayerState, TauntEvent } from "@/lib/game/types";

const Model3DAvatar = dynamic(() => import("./Model3DAvatar"), {
  ssr: false,
});

interface PlayerSeat3DProps {
  player: PlayerState;
  position: "top" | "left" | "right" | "bottom";
  isCurrentTurn: boolean;
  activeTaunt?: TauntEvent | null;
  onDismissTaunt?: () => void;
  isMe?: boolean;
  isHost?: boolean;
  customAvatarIdx?: number;
  isMicOn?: boolean;
  isSpeaking?: boolean;
  turnSecondsLeft?: number | null;
}

export const CHARACTER_PROFILES = [
  {
    id: 0,
    title: "Selena",
    heroName: "Selena",
    icon: "🎤",
    role: "S.T.U.N. Vocalist",
    quote: "Irama kartu, kombo maut! 🎵",
    gradient: "from-purple-500 via-pink-600 to-slate-900",
    borderGlow: "border-purple-400/70",
    hairColor: "#f472b6",
    outfitColor: "#831843",
    modelPath: "/glb/hero_selena_stun_skin.glb",
  },
  {
    id: 1,
    title: "Kagura",
    heroName: "Kagura",
    icon: "☂️",
    role: "Onmyouji Master",
    quote: "3 Sekop di tangan, semua minggir! ♠️",
    gradient: "from-cyan-500 via-blue-700 to-slate-900",
    borderGlow: "border-cyan-400/70",
    hairColor: "#e0e7ff",
    outfitColor: "#4338ca",
    modelPath: "/glb/hero_kagura_old_2016.glb",
  },
  {
    id: 2,
    title: "Natalia",
    heroName: "Natalia",
    icon: "🗡️",
    role: "Silent Assassin",
    quote: "Jangan berani buang 1 Poker! 💣",
    gradient: "from-rose-500 via-purple-700 to-slate-950",
    borderGlow: "border-rose-400/70",
    hairColor: "#fda4af",
    outfitColor: "#881337",
    modelPath: "/glb/hero_natalia_old_2016.glb",
  },
  {
    id: 3,
    title: "Vexana",
    heroName: "Vexana",
    icon: "👑",
    role: "Necromancer Queen",
    quote: "Main santai tapi pasti Juara 1! 👑",
    gradient: "from-emerald-500 via-teal-700 to-slate-950",
    borderGlow: "border-emerald-400/70",
    hairColor: "#a7f3d0",
    outfitColor: "#064e3b",
    modelPath: "/glb/hero_vexana_old_fixed_texture.glb",
  },
];

export default function PlayerSeat3D({
  player,
  position,
  isCurrentTurn,
  activeTaunt,
  onDismissTaunt,
  isMe = false,
  isHost = false,
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

  const facing =
    position === "left" ? "left" : position === "right" ? "right" : "front";

  const avatarSizeClass = isMe
    ? "w-28 h-32 sm:w-32 sm:h-36 lg:w-36 lg:h-40 -mt-14 sm:-mt-18"
    : position === "top"
    ? "w-28 h-32 sm:w-40 sm:h-46 lg:w-48 lg:h-54"
    : "w-36 h-40 sm:w-44 sm:h-48 lg:w-52 lg:h-56";

  const isTop = position === "top";

  return (
    <div
      className={[
        "relative select-none group",
        isTop
          ? "flex flex-row items-center justify-center"
          : "flex flex-col items-center",
      ].join(" ")}
    >
      {/* BALON EMOT / EJEKAN */}
      {activeTaunt && (
        <div
          key={activeTaunt.id}
          onClick={isMe ? onDismissTaunt : undefined}
          title={isMe ? "Klik untuk menutup ejekanmu" : undefined}
          className={[
            "absolute z-50 rounded-2xl bg-gradient-to-br from-white via-amber-50 to-amber-100 text-slate-950 border-2 border-amber-400 shadow-[0_12px_30px_rgba(0,0,0,0.85)] animate-taunt-pop",
            isMe ? "cursor-pointer" : "pointer-events-none",
            !activeTaunt.text || !activeTaunt.text.trim()
              ? "px-3 py-2 flex flex-col items-center justify-center shrink-0 min-w-[70px]"
              : "min-w-[150px] max-w-[215px] px-2.5 py-1.5",
            isMe
              ? "-top-[76px] sm:-top-[84px] left-0 sm:left-1"
              : isTop
              ? "top-1/2 -translate-y-1/2 right-[calc(50%+40px)] sm:right-[calc(50%+52px)] lg:right-[calc(50%+62px)]"
              : position === "left"
              ? "top-4 sm:top-6 left-full ml-1 sm:ml-2"
              : "top-4 sm:top-6 right-full mr-1 sm:mr-2",
          ].join(" ")}
        >
          {!activeTaunt.text || !activeTaunt.text.trim() ? (
            /* TAMPILAN EMOT KILAT TANPA TEKS: JUMBO EMOJI ANIMATED */
            <div className="flex flex-col items-center text-center">
              <span className="text-3xl sm:text-4xl animate-bounce leading-none drop-shadow select-none py-0.5">
                {activeTaunt.emoji}
              </span>
              <span className="text-[8px] font-black uppercase tracking-wider text-purple-700 mt-1 max-w-[85px] truncate leading-tight">
                {player.name}
              </span>
            </div>
          ) : (
            /* TAMPILAN DENGAN KATA-KATA EJEKAN */
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
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* KARAKTER 3D BESAR BERDIRI BEBAS (TANPA KOTAK, TRANSPARAN)         */}
      {/* ================================================================= */}
      <div className="relative flex items-center justify-center shrink-0">
        {/* Glow Aura Emas saat Giliran Berjalan */}
        {isCurrentTurn && (
          <div className="pointer-events-none absolute inset-0 rounded-full bg-amber-400/20 blur-2xl animate-pulse" />
        )}
        {/* Glow Aura Hijau saat Berbicara di Mic */}
        {isSpeaking && (
          <div className="pointer-events-none absolute inset-0 rounded-full bg-emerald-400/25 blur-2xl animate-pulse" />
        )}

        {charProfile.modelPath ? (
          <Model3DAvatar
            modelPath={charProfile.modelPath}
            focus="half"
            facing={facing}
            isCurrentTurn={isCurrentTurn}
            isSpeaking={isSpeaking}
            isForfeited={player.isForfeited}
            className={[avatarSizeClass, "player-avatar-3d"].join(" ")}
            fallback={
              <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-amber-400 flex items-center justify-center text-amber-300 font-bold">
                {charProfile.heroName}
              </div>
            }
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-amber-400 flex items-center justify-center text-amber-300 font-bold">
            {player.name[0]}
          </div>
        )}

        {/* BADGE GILIRAN / FORFEIT / RANK DI SISI KARAKTER */}
        {player.isForfeited ? (
          <div className="absolute top-2 right-1 px-2 py-0.5 rounded-full bg-rose-950/95 border border-rose-500 text-rose-300 font-black text-[9px] shadow-lg">
            🏳️ #{player.finishRank}
          </div>
        ) : player.finishRank !== null ? (
          <div className="absolute top-2 right-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-[9px] shadow-lg border border-white">
            🏆 #{player.finishRank}
          </div>
        ) : isCurrentTurn ? (
          <div
            className={[
              "absolute top-2 right-1 px-2 py-0.5 rounded-full font-black text-[9px] shadow-lg animate-bounce border",
              typeof turnSecondsLeft === "number" && turnSecondsLeft <= 5
                ? "bg-gradient-to-r from-rose-500 to-red-600 text-white border-rose-200"
                : "bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 border-amber-200",
            ].join(" ")}
          >
            {typeof turnSecondsLeft === "number"
              ? `⏱️ ${turnSecondsLeft}s`
              : "⚡ GILIRAN"}
          </div>
        ) : player.hasPassedThisTrick ? (
          <div className="absolute top-2 right-1 px-2 py-0.5 rounded-full bg-slate-900/95 border border-rose-500/60 text-rose-300 font-black text-[9px] uppercase shadow">
            PASS
          </div>
        ) : null}

        {/* BADGE MIC (UNTUK PEMAIN MANUSIA) */}
        {!player.isBot && (
          <div
            className={[
              "absolute top-2 left-1 w-5 h-5 rounded-full flex items-center justify-center border shadow-lg",
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
      </div>

      {/* ================================================================= */}
      {/* NAMEPLATE ELEGAN KAPSUL (DI SAMPING UNTUK TOP, DI BAWAH UNTUK LAINNYA) */}
      {/* ================================================================= */}
      <div
        className={
          isTop
            ? "relative z-20 flex flex-col items-start gap-1 -ml-7 sm:-ml-10 lg:-ml-12 shrink-0"
            : "relative -mt-4 sm:-mt-5 z-20 flex flex-col items-center"
        }
      >
        <div
          className={[
            "player-nameplate px-2.5 py-1 rounded-xl bg-slate-950/90 border backdrop-blur-md shadow-[0_8px_20px_rgba(0,0,0,0.85)] flex items-center gap-1.5 transition-all",
            isCurrentTurn
              ? "border-amber-400 ring-2 ring-amber-400/50 scale-105"
              : "border-amber-400/40",
          ].join(" ")}
        >
          {isHost && (
            <Crown className="w-3 h-3 text-amber-400 shrink-0" />
          )}
          <span className="text-[11px] sm:text-xs font-black text-white truncate max-w-[85px] sm:max-w-[110px] leading-tight">
            {player.name}
          </span>
          <span
            className={[
              "text-[9px] sm:text-[10px] font-mono font-black px-1.5 py-0.2 rounded leading-tight",
              player.totalScore > 0
                ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                : player.totalScore < 0
                ? "bg-rose-950 text-rose-300 border border-rose-500/40"
                : "bg-slate-800 text-amber-300 border border-amber-400/30",
            ].join(" ")}
          >
            {player.totalScore > 0
              ? `+${player.totalScore}`
              : player.totalScore}{" "}
            pts
          </span>
        </div>

        {/* SISA KARTU DI TANGAN LAWAN (BADGE KARTU RAPI DI BAWAH NAMEPLATE) */}
        {!isMe && player.hand.length > 0 && (
          <div className="player-card-badge mt-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-red-950 to-slate-950 border border-amber-400/50 shadow text-[9px] font-black text-amber-300 flex items-center gap-1">
            <span>🃏</span>
            <span>{player.hand.length} kartu</span>
          </div>
        )}
      </div>
    </div>
  );
}
