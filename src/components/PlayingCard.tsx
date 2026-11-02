"use client";

import React from "react";
import { Card, Suit } from "@/lib/game/types";

interface PlayingCardProps {
  card: Card;
  selected?: boolean;
  disabled?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  highlightBomb?: boolean;
  onClick?: () => void;
}

function SuitSvg({
  suit,
  className = "w-4 h-4",
}: {
  suit: Suit;
  className?: string;
}) {
  switch (suit) {
    case "spades":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 2C7 8 3 11.5 3 15a4.5 4.5 0 0 0 7.5 3.3L9 22h6l-1.5-3.7A4.5 4.5 0 0 0 21 15c0-3.5-4-7-9-13z" />
        </svg>
      );
    case "hearts":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case "clubs":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 3a4 4 0 0 0-3.46 6A4 4 0 1 0 6 16.46a4 4 0 0 0 4.5-1.3L9 21h6l-1.5-5.84a4 4 0 0 0 4.5 1.3A4 4 0 1 0 15.46 9 4 4 0 0 0 12 3z" />
        </svg>
      );
    case "diamonds":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 2L20 12L12 22L4 12L12 2Z" />
        </svg>
      );
  }
}

export default function PlayingCard({
  card,
  selected = false,
  disabled = false,
  size = "md",
  highlightBomb = false,
  onClick,
}: PlayingCardProps) {
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const isRoyal = card.value === 11 || card.value === 12 || card.value === 13;

  // Ukuran responsif compact agar 13 kartu muat tanpa scroll di HP maupun Desktop
  const dimensions = {
    xs: "w-[28px] h-[40px] sm:w-[34px] sm:h-[48px] rounded-md",
    sm: "w-10 h-14 rounded-lg",
    md: "w-[48px] h-[70px] sm:w-[58px] sm:h-[84px] lg:w-[62px] lg:h-[90px] rounded-xl",
    lg: "w-[56px] h-[80px] sm:w-[66px] sm:h-[96px] rounded-xl",
  }[size];

  const rankFontSize = {
    xs: "text-[9px] sm:text-[10px]",
    sm: "text-[11px]",
    md: "text-xs sm:text-sm",
    lg: "text-sm sm:text-base",
  }[size];

  const smallSuitSize = {
    xs: "w-1.5 h-1.5 sm:w-2 sm:h-2",
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5 sm:w-3 sm:h-3",
    lg: "w-3 h-3 sm:w-3.5 sm:h-3.5",
  }[size];

  const centerSuitSize = {
    xs: "w-3 h-3 sm:w-3.5 sm:h-3.5",
    sm: "w-4 h-4",
    md: "w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7",
    lg: "w-6 h-6 sm:w-8 sm:h-8",
  }[size];

  const isCompactSize = size === "xs" || size === "sm";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "group relative overflow-hidden bg-white select-none shrink-0",
        size === "md" ? "playing-card-md" : size === "xs" ? "playing-card-xs" : "",
        "transition-all duration-200 ease-out will-change-transform",
        dimensions,
        isRed ? "text-rose-600" : "text-slate-900",
        selected
          ? "-translate-y-3 sm:-translate-y-3.5 scale-105 ring-2 ring-amber-400 border-2 border-amber-400 shadow-[0_4px_0_#d97706,0_12px_20px_rgba(245,158,11,0.5)] z-30"
          : "border border-slate-300 shadow-[0_3px_0_#cbd5e1,0_6px_12px_rgba(0,0,0,0.45)] hover:-translate-y-1.5 hover:shadow-[0_5px_0_#94a3b8,0_10px_16px_rgba(0,0,0,0.6)] hover:z-20",
        highlightBomb && !selected
          ? "ring-2 ring-red-500 border-red-500 animate-pulse shadow-[0_0_16px_rgba(239,68,68,0.8)]"
          : "",
        disabled ? "cursor-default hover:translate-y-0" : "cursor-pointer",
      ].join(" ")}
    >
      {/* Bingkai Tipis Dalam Kartu */}
      <div
        className={[
          "pointer-events-none absolute inset-[2px] sm:inset-[3px] rounded-[7px] sm:rounded-[9px] border",
          isRoyal
            ? "border-amber-400/45 bg-gradient-to-b from-amber-50/35 via-white to-amber-50/35"
            : "border-slate-200/80 bg-gradient-to-b from-white via-slate-50/40 to-slate-100/60",
        ].join(" ")}
      />

      {/* POJOK KIRI ATAS (Absolute) */}
      <div className="pointer-events-none absolute top-0.5 left-1 sm:top-1 sm:left-1 flex flex-col items-center leading-none z-10">
        <span
          className={[
            "font-black tracking-tighter leading-none",
            rankFontSize,
            card.rank === "6" || card.rank === "9" ? "underline" : "",
          ].join(" ")}
        >
          {card.rank}
        </span>
        <SuitSvg suit={card.suit} className={`${smallSuitSize} mt-0.2`} />
      </div>

      {/* ARTWORK TENGAH KARTU (Absolute Center) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-10">
        {isRoyal && !isCompactSize ? (
          <div className="relative flex flex-col items-center justify-center">
            <span className="text-[8px] sm:text-[9px] leading-none mb-0.5 drop-shadow-sm">
              👑
            </span>
            <SuitSvg
              suit={card.suit}
              className={`${centerSuitSize} drop-shadow-sm`}
            />
          </div>
        ) : (
          <SuitSvg suit={card.suit} className={`${centerSuitSize} opacity-90`} />
        )}
      </div>

      {/* POJOK KANAN BAWAH (Sama untuk Semua Kartu) */}
      <div className="pointer-events-none absolute bottom-0.5 right-1 sm:bottom-1 sm:right-1 flex flex-col items-center leading-none rotate-180 z-10 opacity-85">
        <span
          className={[
            "font-black tracking-tighter leading-none",
            rankFontSize,
            card.rank === "6" || card.rank === "9" ? "underline" : "",
          ].join(" ")}
        >
          {card.rank}
        </span>
        <SuitSvg suit={card.suit} className={`${smallSuitSize} mt-0.2`} />
      </div>
    </button>
  );
}
