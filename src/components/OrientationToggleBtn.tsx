"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { soundEngine } from "@/lib/audio/sound-engine";

interface OrientationToggleBtnProps {
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
  variant?: "navbar" | "pill" | "floating" | "icon";
}

export default function OrientationToggleBtn({
  className = "",
  showLabel = true,
  size = "md",
  variant = "navbar",
}: OrientationToggleBtnProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const updateState = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const doc = document as any;
    const fs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
    setIsFullscreen(fs);
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

    if (!isFullscreen) {
      // 1. Target: Masuk ke Mode Fullscreen & Landscape di HP
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

      // Kunci orientasi ke landscape jika didukung browser HP
      if (orientationApi?.lock) {
        try {
          await orientationApi.lock("landscape");
        } catch (err) {
          console.warn("Orientation lock landscape failed:", err);
        }
      }
    } else {
      // 2. Target: Keluar dari Fullscreen (Kembali ke Normal)
      if (orientationApi?.unlock) {
        try {
          orientationApi.unlock();
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

  // Ukuran icon & padding
  const paddingClass =
    size === "sm"
      ? "p-1.5 sm:px-2.5 sm:py-1.5 text-[10px]"
      : "p-2 sm:px-3 sm:py-2 text-xs";
  const iconClass =
    size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={
          isFullscreen
            ? "Keluar dari Layar Penuh (Normal)"
            : "Masuk ke Layar Penuh (Fullscreen)"
        }
        className={[
          "w-10 h-10 rounded-2xl bg-slate-950/90 hover:bg-slate-900 border-2 border-amber-400/60 shadow-[0_6px_20px_rgba(0,0,0,0.8)] flex items-center justify-center text-amber-300 hover:text-white transition transform hover:scale-105 active:scale-95 shrink-0",
          className,
        ].join(" ")}
      >
        {isFullscreen ? (
          <Minimize2 className="w-5 h-5 text-slate-300 hover:text-white" />
        ) : (
          <Maximize2 className="w-5 h-5 text-amber-300 animate-pulse" />
        )}
      </button>
    );
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={
          isFullscreen
            ? "Keluar dari Layar Penuh (Normal)"
            : "Masuk ke Layar Penuh (Fullscreen)"
        }
        className={[
          "flex items-center gap-1.5 rounded-xl font-bold transition shadow-lg active:scale-95 cursor-pointer",
          isFullscreen
            ? "bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300"
            : "bg-amber-400 text-slate-950 font-black shadow-[0_0_15px_rgba(245,158,11,0.3)]",
          paddingClass,
          className,
        ].join(" ")}
      >
        {isFullscreen ? (
          <>
            <Minimize2 className={iconClass} />
            {showLabel && <span>Normal</span>}
          </>
        ) : (
          <>
            <Maximize2 className={iconClass} />
            {showLabel && <span>Fullscreen</span>}
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
        isFullscreen
          ? "Keluar dari Layar Penuh (Normal)"
          : "Masuk ke Layar Penuh (Fullscreen)"
      }
      className={[
        "rounded-xl modern-glass-pill font-bold transition flex items-center gap-1.5 active:scale-95 shrink-0 cursor-pointer",
        isFullscreen
          ? "text-slate-300 hover:text-white"
          : "text-slate-200 hover:text-white",
        paddingClass,
        className,
      ].join(" ")}
    >
      {isFullscreen ? (
        <>
          <Minimize2 className={`${iconClass} text-slate-300`} />
          {showLabel && (
            <span className="hidden sm:inline">Normal</span>
          )}
        </>
      ) : (
        <>
          <Maximize2 className={`${iconClass} text-amber-400`} />
          {showLabel && (
            <span className="hidden sm:inline">Fullscreen</span>
          )}
        </>
      )}
    </button>
  );
}
