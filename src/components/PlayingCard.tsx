"use client";

import React from "react";
import { SUIT_SYMBOLS } from "@/lib/game/shuffle";
import { Card } from "@/lib/game/types";

interface PlayingCardProps {
  card: Card;
  selected?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  highlightBomb?: boolean;
  onClick?: () => void;
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
  const symbol = SUIT_SYMBOLS[card.suit];
  const isPoker = card.value === 15; // Kartu angka 2 = Poker
  const isThreeOfSpades = card.value === 3 && card.suit === "spades";
  const isRoyal = card.value === 11 || card.value === 12 || card.value === 13;

  const sizeClasses = {
    sm: "w-12 h-16 text-[11px] rounded-lg p-1",
    md: "w-16 h-24 sm:w-[74px] sm:h-[108px] text-xs sm:text-sm rounded-xl p-1.5",
    lg: "w-20 h-28 sm:w-24 sm:h-36 text-sm sm:text-base rounded-xl p-2",
  }[size];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "relative flex flex-col justify-between bg-white select-none transition-all duration-200 border shadow-md",
        sizeClasses,
        isRed ? "text-rose-600" : "text-slate-900",
        selected
          ? "-translate-y-4 sm:-translate-y-5 ring-2 ring-amber-400 border-amber-400 shadow-xl shadow-amber-500/20 z-10"
          : "border-slate-200 hover:-translate-y-1.5 hover:shadow-lg",
        highlightBomb && !selected
          ? "ring-2 ring-red-500 border-red-500 animate-pulse"
          : "",
        disabled ? " cursor-default hover:translate-y-0" : "cursor-pointer",
      ].join(" ")}
    >
      {/* Pojok Kiri Atas */}
      <div className="self-start flex flex-col items-center leading-none">
        <span
          className={[
            "font-extrabold tracking-tighter",
            card.rank === "6" || card.rank === "9" ? "underline" : "",
          ].join(" ")}
        >
          {card.rank}
        </span>
        <span className="text-[10px] sm:text-xs">{symbol}</span>
      </div>

      {/* Lambang Tengah & Badge Spesial */}
      <div className="flex flex-col items-center justify-center my-auto">
        <span
          className={
            size === "sm"
              ? "text-base leading-none"
              : "text-xl sm:text-2xl leading-none"
          }
        >
          {symbol}
        </span>

        {size !== "sm" && isPoker && (
          <span className="mt-0.5 px-1 bg-purple-700 text-white text-[8px] sm:text-[9px] font-bold rounded uppercase tracking-wider shadow-sm">
            POKER
          </span>
        )}

        {size !== "sm" && isThreeOfSpades && (
          <span className="mt-0.5 px-1 bg-amber-500 text-slate-950 text-[8px] sm:text-[9px] font-extrabold rounded uppercase tracking-wider">
            AWAL
          </span>
        )}

        {size !== "sm" && isRoyal && (
          <span className="text-[8px] leading-none text-amber-600/90">
            👑
          </span>
        )}
      </div>

      {/* Pojok Kanan Bawah (Terbalik) */}
      <div className="self-end flex flex-col items-center leading-none rotate-180">
        <span
          className={[
            "font-extrabold tracking-tighter",
            card.rank === "6" || card.rank === "9" ? "underline" : "",
          ].join(" ")}
        >
          {card.rank}
        </span>
        <span className="text-[10px] sm:text-xs">{symbol}</span>
      </div>
    </button>
  );
}

