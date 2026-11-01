"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  Bot,
  Crown,
  Flame,
  LogIn,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import GameTable from "@/components/GameTable";
import RulesModal from "@/components/RulesModal";
import {
  dispatchGameAction,
  fetchRoomState,
  generateRoomCode,
  subscribeToRoom,
} from "@/lib/game/room-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { GameState } from "@/lib/game/types";

const SESSION_PLAYER_ID_KEY = "poker_tongkrongan_player_id";
const SESSION_PLAYER_NAME_KEY = "poker_tongkrongan_player_name";

export default function HomePage() {
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("Pemain 1");
  const [joinCodeInput, setJoinCodeInput] = useState<string>("");
  const [activeGameState, setActiveGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);

  const supabaseReady = isSupabaseConfigured();

  // Inisialisasi identitas pemain unik per tab browser (sessionStorage) agar bisa ngetes multi-tab!
  useEffect(() => {
    if (typeof window === "undefined") return;
    let storedId = sessionStorage.getItem(SESSION_PLAYER_ID_KEY);
    if (!storedId) {
      const randBytes = new Uint8Array(4);
      crypto.getRandomValues(randBytes);
      const hex = Array.from(randBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      storedId = `player-${hex}`;
      sessionStorage.setItem(SESSION_PLAYER_ID_KEY, storedId);
    }
    setPlayerId(storedId);

    const savedName = sessionStorage.getItem(SESSION_PLAYER_NAME_KEY);
    if (savedName) {
      setPlayerName(savedName);
    } else {
      setPlayerName(`Sobat ${storedId.slice(-3).toUpperCase()}`);
    }
  }, []);

  // Berlangganan update realtime saat berada di dalam room
  useEffect(() => {
    if (!activeGameState?.roomCode) return;
    const unsubscribe = subscribeToRoom(
      activeGameState.roomCode,
      (updatedState) => {
        setActiveGameState(updatedState);
      }
    );
    return () => unsubscribe();
  }, [activeGameState?.roomCode]);

  const savePlayerName = (val: string) => {
    setPlayerName(val);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_PLAYER_NAME_KEY, val);
    }
  };

  // Buat Room Online Baru
  const handleCreateRoom = async () => {
    const cleanName = playerName.trim() || "Pemain 1";
    setLoading(true);
    setErrorMsg(null);
    try {
      const roomCode = generateRoomCode();
      const state = await dispatchGameAction("create_room", undefined, {
        roomCode,
        hostId: playerId,
        hostName: cleanName,
      });
      setActiveGameState(state);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal membuat room baru."
      );
    } finally {
      setLoading(false);
    }
  };

  // Gabung ke Room yang Sudah Ada
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCodeInput.toUpperCase().trim();
    const cleanName = playerName.trim() || "Pemain Baru";
    if (!code) {
      setErrorMsg("Masukkan kode room terlebih dahulu.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const existingState = await fetchRoomState(code);
      if (!existingState) {
        throw new Error(
          `Room dengan kode "${code}" tidak ditemukan. Pastikan kode benar.`
        );
      }

      // Jika sudah terdaftar di dalam room, langsung masuk kembali (reconnect)
      if (existingState.players.some((p) => p.id === playerId)) {
        setActiveGameState(existingState);
        return;
      }

      const nextState = await dispatchGameAction("join_room", existingState, {
        playerId,
        playerName: cleanName,
        isBot: false,
      });
      setActiveGameState(nextState);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal bergabung ke room."
      );
    } finally {
      setLoading(false);
    }
  };

  // Main Cepat vs Bot (2, 3, atau 4 Pemain langsung bagi kartu!)
  const handleQuickPlayWithBots = async (totalPlayers: 2 | 3 | 4) => {
    const cleanName = playerName.trim() || "Pemain 1";
    setLoading(true);
    setErrorMsg(null);
    try {
      const roomCode = generateRoomCode();
      let state = await dispatchGameAction("create_room", undefined, {
        roomCode,
        hostId: playerId,
        hostName: cleanName,
      });

      const botNames = ["Bot Eko", "Bot Riko", "Bot Sari"];
      for (let i = 0; i < totalPlayers - 1; i++) {
        state = await dispatchGameAction("join_room", state, {
          playerId: `bot-${i + 1}-${Date.now()}`,
          playerName: botNames[i],
          isBot: true,
        });
      }

      // Langsung mulai ronde pertama (Kocok kartu & Fase Kumpul Angka 3)
      state = await dispatchGameAction("start_round", state);
      setActiveGameState(state);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal memulai permainan cepat."
      );
    } finally {
      setLoading(false);
    }
  };

  if (activeGameState) {
    return (
      <GameTable
        gameState={activeGameState}
        myPlayerId={playerId}
        onStateChange={setActiveGameState}
        onLeaveRoom={() => setActiveGameState(null)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-felt-dark via-felt to-felt-dark text-white p-4 sm:p-8">
      {/* Header Brand */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg">
            ♠
          </div>
          <div>
            <h1 className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
              POKER TONGKRONGAN
            </h1>
            <p className="text-[11px] text-emerald-300 font-medium">
              Aturan Kumpul Angka 3 • 3♠ Jalan Awal • Bom Poker
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsRulesOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/40 text-xs sm:text-sm font-semibold text-amber-300 transition shadow"
        >
          <BookOpen className="w-4 h-4" />
          <span>Aturan Main Lengkap</span>
        </button>
      </div>

      {/* Konten Lobby Utama */}
      <div className="max-w-5xl w-full mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Kolom Kiri: Highlight Aturan Khas Tongkrongan */}
        <div className="lg:col-span-6 space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
            <Sparkles className="w-4 h-4" /> 100% Sesuai Aturan Tongkronganmu!
          </div>

          <h2 className="text-3xl sm:text-4xl font-black leading-tight text-white">
            Kumpul Angka 3,{" "}
            <span className="text-amber-400">3 Sekop Jalan Dulu</span>, Awas
            Kena <span className="text-red-400">BOM Poker!</span>
          </h2>

          <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
            Mainkan bersama 2 sampai 4 orang temanmu secara online atau uji strategi melawan Bot AI pintar. Dilengkapi pengocokan kartu kriptografis{" "}
            <strong className="text-emerald-300">
              Real-World CSPRNG + Anti-Repeat
            </strong>{" "}
            sehingga dijamin adil dan tidak berulang!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-950/65 border border-emerald-500/25 space-y-1">
              <div className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                <Crown className="w-4 h-4" /> Kumpul 3 & 3♠ Awal
              </div>
              <p className="text-xs text-slate-300">
                Awal game semua kartu 3 dikumpulkan ke meja. Pemilik 3 Sekop (3♠) jalan pertama!
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/65 border border-red-500/30 space-y-1">
              <div className="font-bold text-red-400 text-sm flex items-center gap-1.5">
                <Flame className="w-4 h-4" /> Bom Lawan 1 Poker (2)
              </div>
              <p className="text-xs text-slate-300">
                1 kartu Poker bisa di-BOM dengan 4 Kartu Kembar atau 5 Seri Sejenis (+10 / -10 poin)!
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/65 border border-emerald-500/25 space-y-1">
              <div className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Kocok Ulang J/Q/K & 4 Poker
              </div>
              <p className="text-xs text-slate-300">
                Otomatis batal & kocok ulang jika ada yang tak dapat J, Q, K atau 1 orang pegang 4 Poker!
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/65 border border-emerald-500/25 space-y-1">
              <div className="font-bold text-sky-400 text-sm flex items-center gap-1.5">
                <Users className="w-4 h-4" /> 52 Kartu Habis (2-4 Orang)
              </div>
              <p className="text-xs text-slate-300">
                Mendukung Single, Double, Triple, Seri Sejenis (3-4-5♠ dilawan 4-5-6♥), & Full House (3+2).
              </p>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Kartu Masuk / Buat Room */}
        <div className="lg:col-span-6 bg-slate-950/85 border-2 border-emerald-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">
          {/* Input Nama Pemain */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-300">
              Nama Panggilan Kamu
            </label>
            <input
              type="text"
              maxLength={18}
              value={playerName}
              onChange={(e) => savePlayerName(e.target.value)}
              placeholder="Masukkan nama kamu..."
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-400 focus:outline-none text-white font-bold text-base"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Opsi 1: Buat Room Mabar / Gabung Kode Room */}
          <div className="space-y-3 pt-1">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Mabar Online / Multi-Tab Bersama Teman
            </div>

            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm sm:text-base shadow-lg shadow-amber-500/20 transition"
            >
              <PlusCircle className="w-5 h-5" />
              Buat Room Baru (Dapatkan Kode Room)
            </button>

            <form onSubmit={handleJoinRoom} className="flex gap-2">
              <input
                type="text"
                maxLength={8}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="KODE ROOM (Misal: AB3X9K)"
                className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-400 focus:outline-none font-mono font-bold uppercase tracking-widest text-sm text-amber-300"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shrink-0"
              >
                <LogIn className="w-4 h-4" />
                Gabung
              </button>
            </form>
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Bot className="w-4 h-4" /> Langsung Main Lawan Bot Pintar
              </span>
              <span className="text-[11px] text-slate-400">
                Cocok untuk tes aturan & latihan
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickPlayWithBots(4)}
                disabled={loading}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 transition"
              >
                <span className="font-extrabold text-sm text-amber-300">
                  4 Pemain
                </span>
                <span className="text-[11px] text-slate-400">
                  Kamu + 3 Bot (13 kartu)
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPlayWithBots(3)}
                disabled={loading}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 transition"
              >
                <span className="font-extrabold text-sm text-emerald-300">
                  3 Pemain
                </span>
                <span className="text-[11px] text-slate-400">
                  Kamu + 2 Bot (17/18 kartu)
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPlayWithBots(2)}
                disabled={loading}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 transition"
              >
                <span className="font-extrabold text-sm text-sky-300">
                  2 Pemain
                </span>
                <span className="text-[11px] text-slate-400">
                  Duel 1v1 (26 kartu)
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-500/20 pt-4">
        <div>
          Engine Pengocokan:{" "}
          <span className="text-emerald-300 font-semibold">
            Server CSPRNG + Riffle/Cut + Anti-Similarity Guard
          </span>
        </div>
        <div>
          Mode Sinkronisasi:{" "}
          {supabaseReady ? (
            <span className="text-emerald-400 font-semibold">
              Supabase Realtime Aktif (Siap Vercel)
            </span>
          ) : (
            <span className="text-amber-300 font-semibold">
              Multi-Tab Broadcast & Bot AI Aktif (Tambahkan .env.local untuk Supabase Online)
            </span>
          )}
        </div>
      </footer>

      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        shuffleMeta={null}
        supabaseReady={supabaseReady}
      />
    </div>
  );
}

