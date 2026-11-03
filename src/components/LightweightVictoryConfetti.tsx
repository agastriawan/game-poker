"use client";

import React, { useMemo } from "react";

interface ConfettiPiece {
  id: number;
  left: string;
  width: string;
  height: string;
  backgroundColor: string;
  borderRadius: string;
  drift: string;
  spin: string;
  duration: string;
  delay: string;
}

const FESTIVE_PALETTE = [
  "#f59e0b", // Amber gold
  "#fbbf24", // Bright gold
  "#10b981", // Emerald green
  "#34d399", // Light emerald
  "#f43f5e", // Crimson rose
  "#fb7185", // Pink rose
  "#06b6d4", // Cyan
  "#38bdf8", // Sky blue
  "#a855f7", // Royal purple
  "#c084fc", // Light purple
  "#ffffff", // Shimmer white
];

export default function LightweightVictoryConfetti() {
  // Generate 22 lightweight particle definitions statically per mount
  const pieces = useMemo<ConfettiPiece[]>(() => {
    return Array.from({ length: 22 }).map((_, i) => {
      // Distribusi merata sepanjang lebar layar (0% - 95%)
      const left = `${(i * 4.5 + Math.sin(i) * 3 + 2).toFixed(1)}%`;
      const color = FESTIVE_PALETTE[i % FESTIVE_PALETTE.length];
      const isRibbon = i % 2 === 0;
      const width = isRibbon ? "6px" : "8px";
      const height = isRibbon ? "14px" : "8px";
      const borderRadius = isRibbon ? "2px" : i % 3 === 0 ? "50%" : "2px";
      const drift = `${(Math.sin(i * 1.5) * 60 + (i % 2 === 0 ? 30 : -30)).toFixed(0)}px`;
      const spin = `${(360 + (i % 4) * 180) * (i % 2 === 0 ? 1 : -1)}deg`;
      const duration = `${(1.6 + (i % 5) * 0.15).toFixed(2)}s`;
      const delay = `${((i % 4) * 0.08).toFixed(2)}s`;

      return {
        id: i,
        left,
        width,
        height,
        backgroundColor: color,
        borderRadius,
        drift,
        spin,
        duration,
        delay,
      };
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[65] overflow-hidden select-none"
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="animate-css-confetti shadow-sm"
          style={
            {
              left: p.left,
              width: p.width,
              height: p.height,
              backgroundColor: p.backgroundColor,
              borderRadius: p.borderRadius,
              animationDelay: p.delay,
              "--drift": p.drift,
              "--spin": p.spin,
              "--duration": p.duration,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

