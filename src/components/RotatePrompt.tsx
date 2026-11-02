"use client";

import React, { useState, useEffect } from "react";
import { Maximize2, RotateCcw, X } from "lucide-react";

export default function RotatePrompt() {
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkOrientation = () => {
      const isMobile =
        window.innerWidth <= 850 ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const portrait = window.innerHeight > window.innerWidth && isMobile;
      setIsPortrait(portrait);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  const handleRequestLandscape = async () => {
    if (typeof document === "undefined") return;
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      const orientationApi = window.screen?.orientation as
        | (ScreenOrientation & { lock?: (mode: string) => Promise<void> })
        | undefined;
      if (orientationApi?.lock) {
        await orientationApi.lock("landscape");
      }
    } catch {
      // Browser might require manual rotation by user
    }
  };

  if (!isPortrait || isDismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 text-center select-none animate-taunt-pop">
      <div className="relative w-full max-w-sm bg-slate-900 border-2 border-amber-400/80 rounded-3xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.9)] space-y-4">
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          title="Tutup & Tetap di Mode Vertikal"
          className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Ikon Animasi Putar Ponsel */}
        <div className="relative w-20 h-20 mx-auto rounded-3xl bg-amber-500/20 border-2 border-amber-400/60 flex items-center justify-center text-3xl">
          <span className="text-4xl animate-bounce">📱</span>
          <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-amber-400 text-slate-950 shadow">
            <RotateCcw className="w-4 h-4 animate-spin" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-black text-amber-300 uppercase tracking-wide">
            Putar Ponsel ke Horizontal
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Poker Barudak dirancang untuk dimainkan dalam posisi{" "}
            <strong className="text-amber-200">Horizontal (Landscape)</strong>{" "}
            seperti game kasino aslinya agar seluruh meja dan kartu terlihat
            penuh!
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={handleRequestLandscape}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Layar Penuh & Putar Otomatis</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="py-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition font-medium underline underline-offset-4"
          >
            Lanjut dalam mode vertikal
          </button>
        </div>
      </div>
    </div>
  );
}

