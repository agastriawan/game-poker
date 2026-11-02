"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Smartphone, Maximize2, Minimize2 } from "lucide-react";
import { soundEngine } from "@/lib/audio/sound-engine";

interface OrientationToggleBtnProps {
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
  variant?: "navbar" | "pill" | "floating";
}

export default function OrientationToggleBtn({
  className = "",
  showLabel = true,
  size = "md",
  variant = "navbar",
}: OrientationToggleBtnProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  const updateState = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const doc = document as any;
    const fs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
    const landscape = window.innerWidth > window.innerHeight;

    setIsFullscreen(fs);
    setIsLandscape(landscape);
  }, []);

  useEffect(() => {
    updateState();

    const doc = document as any;
    doc.addEventListener("fullscreenchange", updateState);
    doc.addEventListener("webkitfullscreenchange", updateState);
    window.addEventListener("resize", updateState);
    window.addEventListener("orientationchange", updateState);

    const orientationApi = window.screen?.orientation as any;
    if (orientationApi?.addEventListener) {
      orientationApi.addEventListener("change", updateState);
    }

    return () => {
      doc.removeEventListener("fullscreenchange", updateState);
      doc.removeEventListener("webkitfullscreenchange", updateState);
      window.removeEventListener("resize", updateState);
      window.removeEventListener("orientationchange", updateState);
      if (orientationApi?.removeEventListener) {
        orientationApi.removeEventListener("change", updateState);
      }
    };
  }, [updateState]);

  const handleToggle = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      soundEngine.playCardClick();
    } catch {}

    if (typeof window === "undefined" || typeof document === "undefined") return;

    const doc = document as any;
    const elem = document.documentElement as any;
    const orientationApi = window.screen?.orientation as any;

    const currentlyLandscapeAndFs = isFullscreen && isLandscape;

    if (!currentlyLandscapeAndFs) {
      // 1. Target: Masuk ke Mode Horizontal Fullscreen (Landscape)
      try {
        if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
          if (elem.requestFullscreen) {
            await elem.requestFullscreen();
          } else if (elem.webkitRequestFullscreen) {
            await elem.webkitRequestFullscreen();
          }
        }
      } catch (err) {
        console.warn("Fullscreen request failed:", err);
      }

      // Lock orientation ke landscape jika didukung browser HP
      if (orientationApi?.lock) {
        try {
          await orientationApi.lock("landscape");
        } catch (err) {
          console.warn("Orientation lock landscape failed:", err);
        }
      }
    } else {
      // 2. Target: Kembali ke Mode Vertikal (Portrait / Normal)
      if (orientationApi?.unlock) {
        try {
          orientationApi.unlock();
        } catch {}
      }
      if (orientationApi?.lock) {
        try {
          await orientationApi.lock("portrait");
        } catch {}
      }

      try {
        if (doc.fullscreenElement || doc.webkitFullscreenElement) {
          if (doc.exitFullscreen) {
            await doc.exitFullscreen();
          } else if (doc.webkitExitFullscreen) {
            await doc.webkitExitFullscreen();
          }
        }
      } catch (err) {
        console.warn("Exit fullscreen failed:", err);
      }
    }

    setTimeout(updateState, 300);
  };

  const isTargetingVertical = isFullscreen && isLandscape;

  // Ukuran icon & padding
  const paddingClass =
    size === "sm"
      ? "p-1.5 sm:px-2 sm:py-1 text-[10px]"
      : "p-2 sm:px-3 sm:py-1.5 text-xs";
  const iconClass =
    size === "sm" ? "w-3 h-3 sm:w-3.5 sm:h-3.5" : "w-3.5 h-3.5 sm:w-4 sm:h-4";

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={
          isTargetingVertical
            ? "Kembali ke mode vertikal"
            : "Putar layar ke horizontal (Layar Penuh)"
        }
        className={[
          "flex items-center gap-1.5 rounded-full font-bold transition shadow-lg active:scale-95",
          isTargetingVertical
            ? "bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300"
            : "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 border border-amber-300 font-extrabold shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse",
          paddingClass,
          className,
        ].join(" ")}
      >
        {isTargetingVertical ? (
          <>
            <Smartphone className={iconClass} />
            {showLabel && <span>Mode Vertikal</span>}
          </>
        ) : (
          <>
            <Smartphone className={`${iconClass} -rotate-90`} />
            {showLabel && <span>Layar Horizontal</span>}
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={
        isTargetingVertical
          ? "Kembali ke mode vertikal (Keluar Layar Penuh)"
          : "Ubah ke mode horizontal (Layar Penuh)"
      }
      className={[
        "rounded-xl border font-black transition flex items-center gap-1.5 active:scale-95 shrink-0",
        isTargetingVertical
          ? "bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
          : "bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-amber-500/25 hover:from-amber-500/35 hover:to-orange-500/30 border-amber-400/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]",
        paddingClass,
        className,
      ].join(" ")}
    >
      {isTargetingVertical ? (
        <>
          <div className="relative flex items-center justify-center">
            <Smartphone className={iconClass} />
            <Minimize2 className="w-2 h-2 absolute -top-0.5 -right-0.5 text-slate-400" />
          </div>
          {showLabel && (
            <span className="hidden sm:inline">Vertikal</span>
          )}
        </>
      ) : (
        <>
          <div className="relative flex items-center justify-center">
            <Smartphone className={`${iconClass} -rotate-90 text-amber-300`} />
            <Maximize2 className="w-2 h-2 absolute -top-0.5 -right-0.5 text-amber-400 animate-pulse" />
          </div>
          {showLabel && (
            <span className="hidden sm:inline">Horizontal</span>
          )}
        </>
      )}
    </button>
  );
}
