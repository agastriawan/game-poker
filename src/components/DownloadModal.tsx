"use client";

import React, { useEffect, useState } from "react";
import {
  Download,
  Smartphone,
  CheckCircle2,
  ExternalLink,
  X,
  Share2,
  ShieldCheck,
} from "lucide-react";

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DownloadModal({ isOpen, onClose }: DownloadModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop">("android");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Deteksi platform user
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform("ios");
    } else if (/android/.test(ua)) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    // Tangkap event PWA install
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  if (!isOpen) return null;

  const APK_DOWNLOAD_URL =
    "https://github.com/agastriawan/game-poker/releases/latest/download/PokerBarudak.apk";
  const GITHUB_RELEASES_URL =
    "https://github.com/agastriawan/game-poker/releases";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-950 border-2 border-emerald-500/50 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-slate-100 max-h-[92vh] flex flex-col overflow-hidden animate-taunt-pop">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 shadow-inner">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Unduh Poker Barudak Mobile
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Gratis
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Pilih cara bermain terbaik untuk perangkat Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Modal */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* OPSI 1: ANDROID APK */}
          <div className="rounded-2xl border-2 border-emerald-400/40 bg-gradient-to-b from-emerald-950/20 to-slate-900/80 p-4 space-y-3 shadow-lg relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                    Pilihan Utama Android
                  </span>
                  <span className="text-[11px] text-slate-400 font-bold">
                    ~4 MB
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-white">
                  Aplikasi Android (.APK)
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                  Aplikasi native Android dengan orientasi Landscape otomatis,
                  layar penuh tanpa URL bar, dan audio responsif tanpa lag.
                </p>
              </div>
            </div>

            {/* Keunggulan APK */}
            <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-[11px] text-slate-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Otomatis Landscape</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Full-screen tanpa browser</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Audio low-latency & voice</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Update otomatis via cloud</span>
              </div>
            </div>

            {/* Tombol Unduh APK */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <a
                href={APK_DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm shadow-[0_4px_20px_rgba(16,185,129,0.4)] transition transform hover:scale-[1.02] active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File APK Android</span>
              </a>

              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noreferrer"
                title="Buka halaman rilisan GitHub"
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-bold transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Rilisan GitHub</span>
              </a>
            </div>

            <p className="text-[10px] text-slate-400 italic">
              *Jika muncul peringatan keamanan browser saat mengunduh APK, pilih
              &quot;Tetap Unduh / Download Anyway&quot; lalu buka file untuk menginstall.
            </p>
          </div>

          {/* OPSI 2: WEB APP / PWA UNTUK IOS & SEMUA PERANGKAT */}
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 font-black text-[10px] uppercase tracking-wider">
                  iPhone / iPad & PWA
                </span>
                <span className="text-[11px] text-slate-400 font-bold">
                  Tanpa Download APK
                </span>
              </div>
              {isInstalled && (
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Terpasang
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-black text-white">
              Pasang ke Layar Utama (Web App)
            </h3>

            {/* Panduan khusus iOS */}
            {platform === "ios" ? (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs text-slate-300">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5" />
                  Cara Pasang di iPhone / iPad (Safari):
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                  <li>Buka website ini menggunakan browser <strong>Safari</strong>.</li>
                  <li>Tekan tombol <strong>Share / Bagikan</strong> (ikon kotak panah ke atas di bagian bawah layar).</li>
                  <li>Gulir ke bawah dan pilih <strong>&quot;Tambahkan ke Layar Utama&quot; (Add to Home Screen)</strong>.</li>
                  <li>Ikon Poker Barudak akan muncul di layar iPhone Anda dan berjalan layaknya aplikasi native!</li>
                </ol>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs text-slate-300">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  Cara Pasang Cepat di Browser:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                  <li>Buka browser Chrome di HP Anda.</li>
                  <li>Klik menu titik tiga (<strong>⋮</strong>) di pojok kanan atas.</li>
                  <li>Pilih <strong>&quot;Tambahkan ke Layar Utama&quot;</strong> atau <strong>&quot;Install Aplikasi&quot;</strong>.</li>
                </ol>
              </div>
            )}

            {/* Tombol Install Instan jika didukung browser */}
            {deferredPrompt && !isInstalled && (
              <button
                type="button"
                onClick={handleInstallPWA}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Pasang Langsung di Layar HP Ini Sekarang</span>
              </button>
            )}
          </div>

          {/* Jaminan Keamanan */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-800 text-[10px] sm:text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              100% Bebas Malware & Open-Source. Dibangun langsung melalui pipeline GitHub Actions resmi.
            </span>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

