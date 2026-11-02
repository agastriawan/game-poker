"use client";

import React from "react";
import { X, ShieldCheck, Flame, Crown, Sparkles, Trophy } from "lucide-react";
import { ShuffleMetadata } from "@/lib/game/types";

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  shuffleMeta: ShuffleMetadata | null;
  supabaseReady: boolean;
}

export default function RulesModal({
  isOpen,
  onClose,
  shuffleMeta,
  supabaseReady,
}: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl text-slate-100 max-h-[92%] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Crown className="w-6 h-6 text-amber-400" />
            <h2 className="text-lg sm:text-xl font-bold text-white">
              Aturan Main & Jaminan Kocok Adil
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm leading-relaxed">
          {/* 1. Pembuka & Kumpul Angka 3 */}
          <section className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-amber-400 flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4" />
              1. Fase Kumpul Angka 3 & Pemilik 3 Sekop (3♠)
            </h3>
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>
                Saat permainan baru dimulai, setelah kocok ulang, atau setelah ronde berakhir karena <strong>BOM</strong>, semua pemain wajib <strong>mengumpulkan seluruh kartu angka 3</strong> di awal.
              </li>
              <li>
                Pemain yang mengeluarkan <strong>3 Sekop (3♠)</strong> berhak jalan paling pertama (bebas mengeluarkan kombinasi apa saja dari sisa kartunya).
              </li>
              <li>
                Jika ronde berakhir normal (tanpa Bom), di game berikutnya <strong>Juara 1 langsung jalan paling awal</strong> tanpa perlu mengumpulkan angka 3 lagi.
              </li>
            </ul>
          </section>

          {/* 2. Urutan Kartu & Kombinasi */}
          <section className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-emerald-400 flex items-center gap-2 text-base">
              <Crown className="w-4 h-4" />
              2. Kekuatan Kartu & Kombinasi Sah
            </h3>
            <p className="text-slate-300">
              Urutan dari terendah ke tertinggi:{" "}
              <code className="px-1.5 py-0.5 bg-slate-950 rounded text-amber-300 font-mono">
                3 &lt; 4 &lt; 5 &lt; 6 &lt; 7 &lt; 8 &lt; 9 &lt; 10 &lt; J &lt; Q &lt; K &lt; A &lt; 2 (POKER)
              </code>
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>
                <strong>Single (1 Kartu), Double (2 Kembar), Triple (3 Kembar):</strong> Dilawan dengan jumlah kartu sama dan <strong>angka yang lebih tinggi</strong> (lambang bebas, misal 3♠ bisa dilawan 4♥).
              </li>
              <li>
                <strong>Seri Sejenis (Minimal 3 Kartu):</strong> Urutan angka berurutan dengan <strong>lambang yang sama</strong> (misal <code className="text-emerald-300">3♠ 4♠ 5♠</code>). Bisa dilawan dengan jumlah kartu seri yang sama dan angka lebih tinggi meskipun beda lambang (misal dilawan <code className="text-rose-300">4♥ 5♥ 6♥</code>).
              </li>
              <li>
                <strong>Full House (5 Kartu):</strong> Terdiri dari 3 kartu kepala + 2 kartu kembar buntut. Bisa berupa:
                <ul className="list-disc list-inside ml-4 mt-0.5 space-y-0.5 text-slate-300">
                  <li><strong>Full House Klasik:</strong> 3 kartu kembar + 2 buntut (misal <code className="text-amber-300">4-4-4 + 3-3</code>).</li>
                  <li><strong>Full House Seri Sejenis:</strong> 3 kartu seri sejenis + 2 buntut (misal <code className="text-amber-300">9♦ 10♦ J♦ + 5♥ 5♠</code>). Nilai penentunya adalah kartu tertinggi serinya (J).</li>
                </ul>
              </li>
              <li>
                <strong>Aturan Habis Kartu & Jalan Bebas:</strong> Jika pemain A menghabiskan seluruh kartunya dan seluruh pemain tidak ada yang membantai kartu terakhir tersebut (semua lawan lewat / Pass), maka meja dikosongkan dan <strong>pemain setelah A bebas mengeluarkan kartu/kombinasi apa saja</strong>.
              </li>
              <li>
                <strong className="text-amber-300">Larangan Poker di Paling Akhir:</strong> Kartu <strong>Poker (angka 2)</strong> <u>TIDAK BOLEH</u> ditaruh atau disisakan di paling akhir sebagai kartu penutup! Kamu wajib mengeluarkan kartu Poker terlebih dahulu sebelum menghabiskan kartu terakhir.
              </li>
            </ul>
          </section>

          {/* 3. Aturan BOM & Kocok Ulang */}
          <section className="bg-red-950/30 border border-red-500/40 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-red-400 flex items-center gap-2 text-base">
              <Flame className="w-4 h-4" />
              3. Aturan BOM Lawan 1 Kartu Poker (2) & Kocok Ulang
            </h3>
            <ul className="list-disc list-inside space-y-1 text-slate-200">
              <li>
                Jika ada pemain mengeluarkan <strong>1 kartu Poker (Single 2)</strong>, pemain lain bisa langsung memotong dengan <strong>BOM</strong> menggunakan:
                <ol className="list-decimal list-inside ml-5 mt-1 text-amber-300 font-medium">
                  <li>4 Kartu Kembar Lengkap (misal empat kartu angka 3: 3♠ 3♥ 3♣ 3♦)</li>
                  <li>5 Kartu Seri Sejenis (misal 3♠ 4♠ 5♠ 6♠ 7♠)</li>
                </ol>
              </li>
              <li>
                <em>Catatan: Double Poker atau Triple Poker TIDAK BISA di-bom!</em>
              </li>
              <li>
                Saat di-bom, <strong>permainan langsung berakhir!</strong> Pengebom dapat <strong>+10 poin</strong>, pengeluar Poker kena <strong>-10 poin</strong>, pemain lain <strong>0 poin</strong>, dan game berikutnya kembali kumpul angka 3.
              </li>
              <li>
                <strong>Kocok Ulang Otomatis (Batal Tanpa Poin):</strong> Jika saat pembagian kartu ada pemain yang <strong>tidak mendapat kartu Kerajaan (J, Q, K) sama sekali</strong>, atau ada 1 pemain yang <strong>memegang 4 kartu Poker (2) sekaligus</strong>, maka otomatis dikocok ulang dan kembali kumpul angka 3.
              </li>
            </ul>
          </section>

          {/* 4. Tabel Poin */}
          <section className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-amber-400 flex items-center gap-2 text-base">
              <Trophy className="w-4 h-4" />
              4. Sistem Poin (2 - 4 Pemain)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-700">
                <div className="font-bold text-white mb-1">Mode 4 Pemain</div>
                <div>🥇 Juara 1: <span className="text-emerald-400 font-bold">+30</span></div>
                <div>🥈 Juara 2: <span className="text-emerald-300 font-bold">+20</span></div>
                <div>🥉 Juara 3: <span className="text-amber-300 font-bold">+10</span></div>
                <div>💀 Juara 4: <span className="text-rose-400 font-bold">-10</span></div>
              </div>
              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-700">
                <div className="font-bold text-white mb-1">Mode 3 Pemain</div>
                <div>🥇 Juara 1: <span className="text-emerald-400 font-bold">+20</span></div>
                <div>🥈 Juara 2: <span className="text-emerald-300 font-bold">+10</span></div>
                <div>💀 Juara 3: <span className="text-rose-400 font-bold">-10</span></div>
              </div>
              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-700">
                <div className="font-bold text-white mb-1">Mode 2 Pemain</div>
                <div>🥇 Juara 1: <span className="text-emerald-400 font-bold">+20</span></div>
                <div>💀 Kalah: <span className="text-rose-400 font-bold">-10</span></div>
              </div>
            </div>
          </section>

          {/* 5. Transparansi Pengocokan Kartu CSPRNG */}
          <section className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-emerald-400 flex items-center gap-2 text-base">
              <ShieldCheck className="w-4 h-4" />
              5. Audit Pengocokan Kartu Adil (Anti-Repeat CSPRNG)
            </h3>
            <p className="text-slate-300 text-xs">
              Kartu dikocok di sisi server menggunakan <strong>Cryptographically Secure RNG (`crypto.getRandomValues`)</strong> dengan simulasi <em>Overhand, Riffle Shuffle, Cut Deck</em>, serta <strong>Anti-Similarity Guard</strong> yang menolak kartu tangan yang mirip dengan ronde sebelumnya.
            </p>
            {shuffleMeta ? (
              <div className="bg-slate-950/80 p-3 rounded-lg border border-emerald-500/20 font-mono text-xs space-y-1 text-emerald-300">
                <div>• Ronde Terakhir: #{shuffleMeta.roundNumber}</div>
                <div>• CSPRNG Entropy Seed: 0x{shuffleMeta.entropyHex}</div>
                <div>
                  • Simulasi Fisik: {shuffleMeta.rifflePasses}x Riffle + Cut di kartu ke-{shuffleMeta.cutIndex}
                </div>
                <div>
                  • Kemiripan Tangan Maks vs Ronde Lalu: {shuffleMeta.similarityScoreMax}% (Sangat Acak)
                </div>
                <div>
                  • Kocok Ulang Otomatis Ronde Ini: {shuffleMeta.redealHistory.length} kali
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">
                Mulai ronde permainan untuk melihat bukti audit pengocokan kartu secara langsung.
              </div>
            )}
            <div className="pt-1 text-xs text-slate-400">
              Status Database:{" "}
              {supabaseReady ? (
                <span className="text-emerald-400 font-semibold">
                  ● Terhubung ke Supabase Realtime (Online Lintas Perangkat Aktif)
                </span>
              ) : (
                <span className="text-amber-300 font-semibold">
                  ● Mode Lokal / Multi-Tab Browser Aktif (Isi .env.local dengan URL & Key Supabase saat ingin deploy online lintas perangkat)
                </span>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition"
          >
            Mengerti, Kembali ke Meja
          </button>
        </div>
      </div>
    </div>
  );
}

