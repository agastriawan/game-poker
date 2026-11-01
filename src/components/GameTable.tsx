"use client";

import React, { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import {
  BookOpen,
  Bot,
  Check,
  Copy,
  Crown,
  Flame,
  Lightbulb,
  LogOut,
  Play,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Trash2,
} from "lucide-react";
import PlayingCard from "./PlayingCard";
import RulesModal from "./RulesModal";
import { getNextBotAction } from "@/lib/game/bot";
import {
  canBeatPlay,
  evaluateCombo,
  findAllBombsInHand,
  findAllValidPlays,
} from "@/lib/game/rules";
import { dispatchGameAction } from "@/lib/game/room-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { GameState } from "@/lib/game/types";

interface GameTableProps {
  gameState: GameState;
  myPlayerId: string;
  onStateChange: (nextState: GameState) => void;
  onLeaveRoom: () => void;
}

const BOT_NAMES = ["Bot Eko", "Bot Riko", "Bot Sari", "Bot Dodi"];

export default function GameTable({
  gameState,
  myPlayerId,
  onStateChange,
  onLeaveRoom,
}: GameTableProps) {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [hintIndex, setHintIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  const supabaseReady = isSupabaseConfigured();

  const myPlayer = useMemo(
    () => gameState.players.find((p) => p.id === myPlayerId) || gameState.players[0],
    [gameState.players, myPlayerId]
  );

  const isHost = gameState.hostId === myPlayer?.id;
  const isMyTurn =
    gameState.phase === "playing" &&
    gameState.currentTurnPlayerId === myPlayer?.id;

  // Bersihkan pilihan kartu saat ronde atau giliran berubah
  useEffect(() => {
    setSelectedCardIds([]);
    setHintIndex(0);
    setErrorMsg(null);
  }, [gameState.roundNumber, gameState.phase, gameState.currentTurnPlayerId]);

  // Efek Confetti saat Juara 1 atau berhasil mengebom
  useEffect(() => {
    if (gameState.phase === "round_end" && gameState.roundSummary) {
      const myResult = gameState.roundSummary.rankings.find(
        (r) => r.playerId === myPlayer?.id
      );
      if (myResult && myResult.scoreDelta > 0) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {
          // ignore
        }
      }
    }
  }, [gameState.phase, gameState.roundSummary, myPlayer?.id]);

  // Otomasi langkah Bot (dijalankan oleh Host atau pemain aktif agar terkoordinasi)
  useEffect(() => {
    const botAction = getNextBotAction(gameState);
    if (!botAction) return;

    const timer = setTimeout(async () => {
      try {
        if (botAction.actionType === "submit_threes") {
          const next = await dispatchGameAction("submit_threes", gameState, {
            playerId: botAction.botId,
          });
          onStateChange(next);
        } else if (
          (botAction.actionType === "bomb_intercept" ||
            botAction.actionType === "play") &&
          botAction.cardIds
        ) {
          const next = await dispatchGameAction("play_cards", gameState, {
            playerId: botAction.botId,
            cardIds: botAction.cardIds,
          });
          onStateChange(next);
        } else if (botAction.actionType === "pass") {
          const next = await dispatchGameAction("pass_turn", gameState, {
            playerId: botAction.botId,
          });
          onStateChange(next);
        }
      } catch (err) {
        console.error("Bot step error:", err);
      }
    }, 850);

    return () => clearTimeout(timer);
  }, [gameState, onStateChange]);

  // Evaluasi kartu yang sedang dipilih pemain
  const selectedCardsObj = useMemo(() => {
    if (!myPlayer) return [];
    const set = new Set(selectedCardIds);
    return myPlayer.hand.filter((c) => set.has(c.id));
  }, [myPlayer, selectedCardIds]);

  const evaluatedSelectedCombo = useMemo(
    () => evaluateCombo(selectedCardsObj),
    [selectedCardsObj]
  );

  const currentTableCombo = gameState.currentTablePlay
    ? gameState.currentTablePlay.combo
    : null;

  const beatValidation = useMemo(() => {
    if (!evaluatedSelectedCombo) return null;
    return canBeatPlay(evaluatedSelectedCombo, currentTableCombo);
  }, [evaluatedSelectedCombo, currentTableCombo]);

  // Cek semua langkah valid & Bom yang dimiliki pemain saat ini
  const myValidPlays = useMemo(() => {
    if (!myPlayer || gameState.phase !== "playing") return [];
    return findAllValidPlays(myPlayer.hand, currentTableCombo);
  }, [myPlayer, gameState.phase, currentTableCombo]);

  const myBombs = useMemo(() => {
    if (!myPlayer || gameState.phase !== "playing") return [];
    return findAllBombsInHand(myPlayer.hand);
  }, [myPlayer, gameState.phase]);

  // Apakah saat ini lawan baru saja mengeluarkan Single Poker (2) dan kita punya senjata Bom?
  const canDetonateBombNow = useMemo(() => {
    if (
      gameState.phase !== "playing" ||
      !gameState.currentTablePlay ||
      !myPlayer ||
      myPlayer.finishRank !== null
    ) {
      return false;
    }
    const isSinglePokerOnTable =
      gameState.currentTablePlay.combo.type === "single" &&
      gameState.currentTablePlay.combo.primaryValue === 15;
    const isOpponentPoker =
      gameState.currentTablePlay.playerId !== myPlayer.id;

    return isSinglePokerOnTable && isOpponentPoker && myBombs.length > 0;
  }, [gameState.phase, gameState.currentTablePlay, myPlayer, myBombs]);

  // Kumpulan ID kartu di tangan yang termasuk bagian dari Bom (untuk highlight visual)
  const bombCardIdsSet = useMemo(() => {
    const set = new Set<string>();
    if (canDetonateBombNow) {
      for (const b of myBombs) {
        for (const c of b.cards) set.add(c.id);
      }
    }
    return set;
  }, [canDetonateBombNow, myBombs]);

  const toggleCardSelection = (cardId: string) => {
    setErrorMsg(null);
    setSelectedCardIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(gameState.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleAddBot = async () => {
    if (gameState.players.length >= 4 || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const existingNames = new Set(gameState.players.map((p) => p.name));
      const botName =
        BOT_NAMES.find((n) => !existingNames.has(n)) ||
        `Bot #${gameState.players.length}`;
      const botId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const next = await dispatchGameAction("join_room", gameState, {
        playerId: botId,
        playerName: botName,
        isBot: true,
      });
      onStateChange(next);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menambah Bot.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePlayer = async (targetId: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const next = await dispatchGameAction("remove_player", gameState, {
        playerId: targetId,
      });
      onStateChange(next);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menghapus pemain.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRound = async () => {
    if (gameState.players.length < 2 || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const next = await dispatchGameAction("start_round", gameState);
      onStateChange(next);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memulai ronde.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitThrees = async () => {
    if (!myPlayer || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const next = await dispatchGameAction("submit_threes", gameState, {
        playerId: myPlayer.id,
      });
      onStateChange(next);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal mengumpulkan angka 3."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlaySelectedCards = async () => {
    if (!myPlayer || selectedCardIds.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const next = await dispatchGameAction("play_cards", gameState, {
        playerId: myPlayer.id,
        cardIds: selectedCardIds,
      });
      setSelectedCardIds([]);
      onStateChange(next);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Langkah tidak sah.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetonateBombInstant = async (bombCardIds: string[]) => {
    if (!myPlayer || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const next = await dispatchGameAction("play_cards", gameState, {
        playerId: myPlayer.id,
        cardIds: bombCardIds,
      });
      setSelectedCardIds([]);
      onStateChange(next);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal meledakkan Bom.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePassTurn = async () => {
    if (!myPlayer || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const next = await dispatchGameAction("pass_turn", gameState, {
        playerId: myPlayer.id,
      });
      setSelectedCardIds([]);
      onStateChange(next);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Tidak bisa lewat.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCycleHint = () => {
    if (myValidPlays.length === 0) {
      setErrorMsg(
        "Tidak ada kombinasi kartu di tangan yang bisa mengalahkan kartu di meja. Silakan klik Lewat (Pass)."
      );
      return;
    }
    const targetPlay = myValidPlays[hintIndex % myValidPlays.length];
    setSelectedCardIds(targetPlay.cards.map((c) => c.id));
    setHintIndex((prev) => prev + 1);
    setErrorMsg(null);
  };

  // Urutkan lawan relatif terhadap kursi pemain kita
  const opponents = useMemo(() => {
    if (!myPlayer) return [];
    const myIdx = gameState.players.findIndex((p) => p.id === myPlayer.id);
    const list = [];
    for (let i = 1; i < gameState.players.length; i++) {
      list.push(gameState.players[(myIdx + i) % gameState.players.length]);
    }
    return list;
  }, [gameState.players, myPlayer]);

  const myThreesCount = useMemo(() => {
    if (!myPlayer) return 0;
    return myPlayer.hand.filter((c) => c.value === 3).length;
  }, [myPlayer]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-felt-dark via-felt to-felt-dark text-white">
      {/* HEADER BAR */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-950/80 border-b border-emerald-500/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-950/90 border border-emerald-500/40 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-emerald-300 font-medium">ROOM:</span>
            <span className="font-mono font-extrabold text-amber-400 tracking-wider">
              {gameState.roomCode}
            </span>
            <button
              onClick={handleCopyRoomCode}
              title="Salin Kode Room"
              className="text-slate-300 hover:text-white transition"
            >
              {copiedCode ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          {gameState.roundNumber > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200">
              Ronde #{gameState.roundNumber} •{" "}
              {gameState.mustCollectThrees ? (
                <span className="text-amber-400">Mode Kumpul 3 (3♠ Awal)</span>
              ) : (
                <span className="text-emerald-400">Mode Juara 1 Jalan Awal</span>
              )}
            </div>
          )}
        </div>

        {/* Status Koneksi & Tombol Panduan/Keluar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRulesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-amber-300 transition"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Aturan & Audit Kocok</span>
            <BookOpen className="w-3.5 h-3.5 sm:hidden" />
          </button>

          <button
            onClick={onLeaveRoom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-xs font-semibold text-rose-200 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* NOTIFIKASI KOCOK ULANG OTOMATIS (REDEAL) JIKA TERJADI DI RONDE INI */}
      {gameState.shuffleMeta &&
        gameState.shuffleMeta.redealHistory.length > 0 &&
        gameState.phase !== "waiting" && (
          <div className="bg-amber-500/20 border-b border-amber-400/50 px-4 py-2 text-center text-xs sm:text-sm text-amber-200 flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />
            <span>
              <strong>BOM KOCOK ULANG OTOMATIS!</strong>{" "}
              {
                gameState.shuffleMeta.redealHistory[
                  gameState.shuffleMeta.redealHistory.length - 1
                ].description
              }
            </span>
          </div>
        )}

      {/* AREA UTAMA MEJA */}
      <main className="flex-1 flex flex-col justify-between max-w-6xl w-full mx-auto px-3 py-2 sm:px-5 sm:py-3 gap-2.5">
        {/* BARIS LAWAN & PAPAN SKOR */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-start">
          {/* Papan Skor Ringkas */}
          <div className="bg-slate-950/75 border border-emerald-500/25 rounded-2xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Papan Poin ({gameState.players.length} Pemain)
              </span>
              <span className="text-[11px] text-slate-400">
                {supabaseReady ? "🟢 Online" : "🟡 Lokal/Multi-Tab"}
              </span>
            </div>
            <div className="space-y-1.5">
              {[...gameState.players]
                .sort((a, b) => b.totalScore - a.totalScore)
                .map((p, idx) => (
                  <div
                    key={p.id}
                    className={[
                      "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs",
                      p.id === myPlayer?.id
                        ? "bg-emerald-900/50 border border-emerald-500/40 font-semibold"
                        : "bg-slate-900/60",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-slate-400 font-mono">#{idx + 1}</span>
                      <span className="truncate">{p.name}</span>
                      {p.id === myPlayer?.id && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-600 rounded text-white">
                          Kamu
                        </span>
                      )}
                      {p.finishRank && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold rounded">
                          Juara {p.finishRank}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.lastRoundDelta !== 0 && (
                        <span
                          className={
                            p.lastRoundDelta > 0
                              ? "text-[10px] text-emerald-400"
                              : "text-[10px] text-rose-400"
                          }
                        >
                          ({p.lastRoundDelta > 0 ? `+${p.lastRoundDelta}` : p.lastRoundDelta})
                        </span>
                      )}
                      <span
                        className={[
                          "font-mono font-bold px-1.5 py-0.5 rounded",
                          p.totalScore > 0
                            ? "text-emerald-300 bg-emerald-950"
                            : p.totalScore < 0
                            ? "text-rose-300 bg-rose-950"
                            : "text-slate-300 bg-slate-800",
                        ].join(" ")}
                      >
                        {p.totalScore > 0 ? `+${p.totalScore}` : p.totalScore} pts
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Kartu Lawan di Meja */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {opponents.map((opp) => {
              const isOppTurn =
                gameState.phase === "playing" &&
                gameState.currentTurnPlayerId === opp.id;
              return (
                <div
                  key={opp.id}
                  className={[
                    "relative flex flex-col justify-between p-3.5 rounded-2xl border transition-all",
                    isOppTurn
                      ? "bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/50 shadow-lg"
                      : "bg-slate-950/65 border-slate-800",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                        {opp.isBot ? (
                          <Bot className="w-4 h-4 text-amber-300" />
                        ) : (
                          opp.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-sm truncate flex items-center gap-1.5">
                          {opp.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Poin:{" "}
                          <span className="text-white font-semibold">
                            {opp.totalScore > 0
                              ? `+${opp.totalScore}`
                              : opp.totalScore}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Badge Status Lawan */}
                    {isOppTurn && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[11px] animate-pulse">
                        GILIRAN JALAN
                      </span>
                    )}
                    {opp.finishRank !== null && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-extrabold text-[11px]">
                        JUARA #{opp.finishRank}
                      </span>
                    )}
                    {!isOppTurn &&
                      opp.finishRank === null &&
                      opp.hasPassedThisTrick && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-semibold text-[11px]">
                          LEWAT (PASS)
                        </span>
                      )}
                  </div>

                  {/* Info Sisa Kartu & Kumpul 3 Lawan */}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 font-semibold text-amber-300">
                        🂠 {opp.hand.length} Kartu Tersisa
                      </div>
                    </div>
                    {opp.collectedThrees.length > 0 && (
                      <div className="text-[11px] text-emerald-300 font-medium">
                        Kumpul 3:{" "}
                        {opp.collectedThrees
                          .map(
                            (c) =>
                              `3${
                                c.suit === "spades"
                                  ? "♠"
                                  : c.suit === "hearts"
                                  ? "♥"
                                  : c.suit === "clubs"
                                  ? "♣"
                                  : "♦"
                              }`
                          )
                          .join(" ")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {opponents.length === 0 && (
              <div className="sm:col-span-3 flex items-center justify-center p-6 rounded-2xl border border-dashed border-emerald-500/30 bg-slate-950/40 text-slate-300 text-sm">
                Belum ada lawan di meja. Tambahkan Bot atau bagikan Kode Room{" "}
                <strong className="mx-1 text-amber-400 font-mono">
                  {gameState.roomCode}
                </strong>{" "}
                ke temanmu!
              </div>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* TENGAH MEJA (FELT ARENA): LOBBY / KUMPUL 3 / PLAYING / ROUND END */}
        {/* ================================================================= */}
        <div className="relative flex-1 min-h-[195px] flex flex-col items-center justify-center rounded-3xl border-4 border-amber-500/30 bg-radial from-felt-light to-felt-dark shadow-inner p-3 sm:p-4">
          {/* 1. FASE WAITING (LOBBY MEJA) */}
          {gameState.phase === "waiting" && (
            <div className="w-full max-w-lg bg-slate-950/85 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 text-center space-y-5 shadow-2xl">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                  <Users className="w-3.5 h-3.5" /> Ruang Tunggu Pemain (
                  {gameState.players.length}/4 Pemain)
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  Siap Mulai Permainan?
                </h2>
                <p className="text-xs sm:text-sm text-slate-300">
                  Bagikan kode room{" "}
                  <span className="font-mono font-bold text-amber-400">
                    {gameState.roomCode}
                  </span>{" "}
                  ke temanmu (bisa buka tab baru untuk tes multi-pemain) atau tambahkan Bot untuk langsung bermain!
                </p>
              </div>

              {/* Daftar Pemain di Kursi */}
              <div className="space-y-2 text-left">
                {gameState.players.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-emerald-700 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-sm">{p.name}</span>
                      {p.id === gameState.hostId && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Host
                        </span>
                      )}
                      {p.isBot && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          Bot AI
                        </span>
                      )}
                    </div>

                    {isHost && p.id !== myPlayer?.id && (
                      <button
                        onClick={() => handleRemovePlayer(p.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition"
                        title="Keluarkan dari meja"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Tombol Tambah Bot & Mulai */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {gameState.players.length < 4 && (
                  <button
                    onClick={handleAddBot}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-semibold text-amber-300 transition"
                  >
                    <UserPlus className="w-4 h-4" />
                    Tambah Lawan Bot ({gameState.players.length}/4)
                  </button>
                )}

                <button
                  onClick={handleStartRound}
                  disabled={gameState.players.length < 2 || isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/25 transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Bagikan 52 Kartu & Mulai ({gameState.players.length} Orang)
                </button>
              </div>
            </div>
          )}

          {/* 2. FASE COLLECTING THREES (KUMPUL ANGKA 3) */}
          {gameState.phase === "collecting_threes" && (
            <div className="w-full max-w-2xl bg-slate-950/85 border-2 border-amber-400/50 rounded-2xl p-5 sm:p-6 text-center space-y-5 shadow-2xl">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" /> Aturan Pembuka Ronde
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  Fase Kumpul Angka 3!
                </h2>
                <p className="text-xs sm:text-sm text-slate-300">
                  Semua pemain wajib mengeluarkan seluruh kartu angka{" "}
                  <strong className="text-amber-300">3</strong> di awal permainan. Pemegang{" "}
                  <strong className="text-amber-400">3 Sekop (3♠)</strong> akan jalan paling pertama!
                </p>
              </div>

              {/* Kartu 3 yang Sudah Terkumpul di Meja */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {gameState.players.map((p) => {
                  const entry = gameState.collectedThreesPool.find(
                    (e) => e.playerId === p.id
                  );
                  return (
                    <div
                      key={p.id}
                      className={[
                        "p-3 rounded-xl border flex items-center justify-between",
                        entry?.hasThreeOfSpades
                          ? "bg-amber-500/20 border-amber-400"
                          : entry
                          ? "bg-emerald-950/60 border-emerald-500/30"
                          : "bg-slate-900/60 border-slate-800",
                      ].join(" ")}
                    >
                      <div>
                        <div className="font-bold text-sm flex items-center gap-1.5">
                          {p.name}
                          {entry?.hasThreeOfSpades && (
                            <span className="px-2 py-0.5 text-[10px] bg-amber-400 text-slate-950 font-extrabold rounded-full">
                              👑 PEMILIK 3♠
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5">
                          {!entry ? (
                            <span className="text-amber-300 animate-pulse">
                              Menunggu kumpul angka 3...
                            </span>
                          ) : entry.cards.length === 0 ? (
                            <span className="text-slate-400">
                              Tidak memegang angka 3
                            </span>
                          ) : (
                            <span className="text-emerald-300 font-semibold">
                              Mengumpulkan {entry.cards.length} kartu 3
                            </span>
                          )}
                        </div>
                      </div>

                      {entry && entry.cards.length > 0 && (
                        <div className="flex -space-x-3">
                          {entry.cards.map((c) => (
                            <PlayingCard
                              key={c.id}
                              card={c}
                              size="sm"
                              disabled
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tombol Kumpul Angka 3 untuk Pemain */}
              {myPlayer && !myPlayer.hasSubmittedThrees && (
                <button
                  onClick={handleSubmitThrees}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm sm:text-base shadow-xl shadow-amber-500/25 transition transform hover:scale-[1.02]"
                >
                  {myThreesCount > 0
                    ? `🃏 Keluarkan ${myThreesCount} Kartu Angka 3 Saya Sekarang`
                    : `✅ Saya Tidak Punya Angka 3 — Siap Mulai`}
                </button>
              )}
            </div>
          )}

          {/* 3. FASE PLAYING (ARENA BANTING KARTU) */}
          {gameState.phase === "playing" && (
            <div className="w-full flex flex-col items-center justify-center space-y-4">
              {/* Banner Giliran Siapa */}
              <div className="px-4 py-1.5 rounded-full bg-slate-950/80 border border-emerald-500/30 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-md">
                {isMyTurn ? (
                  <span className="text-amber-400 font-extrabold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> GILIRAN KAMU JALAN!{" "}
                    {!gameState.currentTablePlay &&
                      "(Meja Kosong — Bebas Keluarkan Kombinasi Apa Saja)"}
                  </span>
                ) : (
                  <span className="text-slate-200">
                    Menunggu giliran:{" "}
                    <strong className="text-amber-300">
                      {
                        gameState.players.find(
                          (p) => p.id === gameState.currentTurnPlayerId
                        )?.name
                      }
                    </strong>
                  </span>
                )}
              </div>

              {/* Kartu yang Sedang Berada di Meja */}
              {gameState.currentTablePlay ? (
                <div className="flex flex-col items-center space-y-3 animate-card-pop">
                  <div className="text-xs sm:text-sm bg-slate-950/90 px-4 py-1.5 rounded-full border border-amber-400/40 text-amber-300 font-bold shadow">
                    {gameState.currentTablePlay.playerName} mengeluarkan:{" "}
                    <span className="text-white">
                      {gameState.currentTablePlay.combo.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap py-2">
                    {gameState.currentTablePlay.combo.cards.map((card) => (
                      <PlayingCard
                        key={card.id}
                        card={card}
                        size="lg"
                        disabled
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-10 px-6 rounded-2xl border-2 border-dashed border-emerald-400/30 bg-emerald-950/30 text-center space-y-1">
                  <div className="text-emerald-300 font-bold text-base">
                    Meja Sedang Bersih
                  </div>
                  <div className="text-xs text-slate-300">
                    Pemegang giliran bebas memulai dengan Single, Double, Triple, Seri Sejenis, atau Full House (3+2).
                  </div>
                </div>
              )}

              {/* TOMBOL INTERAKTIF SPESIAL: LEDAKKAN BOM SAAT LAWAN KELUARKAN 1 POKER! */}
              {canDetonateBombNow && (
                <div className="w-full max-w-xl bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-2 border-amber-400 rounded-2xl p-4 text-center space-y-3 shadow-2xl animate-bounce">
                  <div className="text-xs sm:text-sm font-extrabold text-amber-300 flex items-center justify-center gap-1.5 uppercase">
                    <Flame className="w-5 h-5 text-amber-400" /> KESEMPATAN BOM! Lawan mengeluarkan 1 Kartu Poker (2)!
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {myBombs.map((bomb, idx) => (
                      <button
                        key={idx}
                        onClick={() =>
                          handleDetonateBombInstant(
                            bomb.cards.map((c) => c.id)
                          )
                        }
                        disabled={isSubmitting}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-red-500 hover:from-amber-300 hover:to-red-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg transition transform hover:scale-105"
                      >
                        💣 LEDAKKAN {bomb.label} (+10 Poin & Akhiri Game!)
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. FASE ROUND END (HASIL AKHIR RONDE & PERHITUNGAN POIN) */}
          {gameState.phase === "round_end" && gameState.roundSummary && (
            <div className="w-full max-w-xl bg-slate-950/95 border-2 border-amber-400/60 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl animate-card-pop">
              {gameState.roundSummary.endReason === "bomb" &&
              gameState.roundSummary.bombResolution ? (
                <div className="text-center space-y-2 bg-red-950/60 border border-red-500/50 rounded-xl p-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500 text-white text-xs font-black uppercase">
                    <Flame className="w-4 h-4" /> PERMAINAN BERAKHIR KARENA BOM!
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-amber-300">
                    💣 {gameState.roundSummary.bombResolution.bomberName}{" "}
                    Mengebom Kartu Poker{" "}
                    {gameState.roundSummary.bombResolution.victimName}!
                  </h2>
                  <p className="text-xs text-slate-200">
                    Senjata Bom:{" "}
                    <strong>
                      {gameState.roundSummary.bombResolution.bombCombo.label}
                    </strong>{" "}
                    • Ronde berikutnya kembali di-reset ke{" "}
                    <strong className="text-amber-300">
                      Kumpul Angka 3 (3♠ Jalan Awal)
                    </strong>
                    !
                  </p>
                  <div className="flex items-center justify-center gap-1.5 pt-2">
                    {gameState.roundSummary.bombResolution.bombCombo.cards.map(
                      (c) => (
                        <PlayingCard key={c.id} card={c} size="sm" disabled />
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                    <Crown className="w-4 h-4 text-amber-400" /> Ronde #
                    {gameState.roundSummary.roundNumber} Selesai Normal
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                    Juara 1: {gameState.roundSummary.nextStarterName}!
                  </h2>
                  <p className="text-xs text-slate-300">
                    Sesuai aturan: Di ronde berikutnya{" "}
                    <strong className="text-amber-300">
                      {gameState.roundSummary.nextStarterName}
                    </strong>{" "}
                    akan jalan paling awal (bebas mengeluarkan kartu apa saja tanpa kumpul angka 3).
                  </p>
                </div>
              )}

              {/* Tabel Perolehan Poin Ronde Ini */}
              <div className="space-y-2">
                {gameState.roundSummary.rankings.map((r) => (
                  <div
                    key={r.playerId}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                        {r.statusLabel}
                      </span>
                      <span className="font-bold text-white">
                        {r.playerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span
                        className={[
                          "font-extrabold",
                          r.scoreDelta > 0
                            ? "text-emerald-400"
                            : r.scoreDelta < 0
                            ? "text-rose-400"
                            : "text-slate-400",
                        ].join(" ")}
                      >
                        {r.scoreDelta > 0 ? `+${r.scoreDelta}` : r.scoreDelta}
                      </span>
                      <span className="text-xs text-slate-400">
                        Total:{" "}
                        <strong className="text-white">
                          {r.newTotalScore > 0
                            ? `+${r.newTotalScore}`
                            : r.newTotalScore}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-center pt-2">
                <button
                  onClick={handleStartRound}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm sm:text-base shadow-xl transition"
                >
                  🚀 Kocok Kartu & Mulai Ronde #{gameState.roundNumber + 1}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* AREA TANGAN PEMAIN SENDIRI & PANEL KONTROL BAWAH                  */}
        {/* ================================================================= */}
        {myPlayer && gameState.phase !== "waiting" && (
          <div className="bg-slate-950/85 border border-emerald-500/30 rounded-3xl p-3 sm:p-4 space-y-2.5 shadow-2xl">
            {/* Baris Info Kombinasi & Error */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  Tangan {myPlayer.name} ({myPlayer.hand.length} Kartu)
                </span>
                {myPlayer.collectedThrees.length > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-medium">
                    Angka 3 Terkumpul:{" "}
                    {myPlayer.collectedThrees
                      .map(
                        (c) =>
                          `3${
                            c.suit === "spades"
                              ? "♠"
                              : c.suit === "hearts"
                              ? "♥"
                              : c.suit === "clubs"
                              ? "♣"
                              : "♦"
                          }`
                      )
                      .join(", ")}
                  </span>
                )}
              </div>

              {/* Indikator Real-Time Kombinasi Kartu yang Dipilih */}
              {selectedCardIds.length > 0 && (
                <div className="text-xs font-semibold">
                  {evaluatedSelectedCombo ? (
                    beatValidation?.valid ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300">
                        ✅ {evaluatedSelectedCombo.label}{" "}
                        {beatValidation.isBomb ? "(SIAP BOM!)" : "(Sah untuk Jalan)"}
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400 text-rose-300">
                        ❌ {evaluatedSelectedCombo.label} —{" "}
                        {beatValidation?.reason}
                      </span>
                    )
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300">
                      ⚠️ Pilihan belum membentuk kombinasi sah (Gunakan Single, Double, Triple, Seri Sejenis, Full House 3+2, atau Bom)
                    </span>
                  )}
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="px-4 py-2 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs sm:text-sm font-medium">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Barisan Kartu di Tangan Pemain */}
            <div className="flex items-center justify-center flex-wrap gap-1.5 sm:gap-2 pt-3 pb-1 min-h-[120px]">
              {myPlayer.hand.map((card) => {
                const isSelected = selectedCardIds.includes(card.id);
                const isBombCard = bombCardIdsSet.has(card.id);
                return (
                  <PlayingCard
                    key={card.id}
                    card={card}
                    selected={isSelected}
                    highlightBomb={isBombCard}
                    disabled={gameState.phase !== "playing"}
                    onClick={() => toggleCardSelection(card.id)}
                  />
                );
              })}

              {myPlayer.hand.length === 0 && (
                <div className="text-emerald-400 font-bold text-sm py-8">
                  🎉 Kartu kamu sudah habis! Menunggu ronde selesai...
                </div>
              )}
            </div>

            {/* Tombol Aksi saat Fase Bermain */}
            {gameState.phase === "playing" && myPlayer.finishRank === null && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCycleHint}
                    disabled={!isMyTurn && !canDetonateBombNow}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-600 text-xs sm:text-sm font-semibold text-amber-300 transition"
                  >
                    <Lightbulb className="w-4 h-4" />
                    Saran Kombinasi ({myValidPlays.length})
                  </button>

                  {selectedCardIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCardIds([])}
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs sm:text-sm text-slate-300 transition"
                    >
                      Batal Pilih
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handlePassTurn}
                    disabled={
                      !isMyTurn || !gameState.currentTablePlay || isSubmitting
                    }
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-600 text-xs sm:text-sm font-bold text-slate-200 transition"
                  >
                    <SkipForward className="w-4 h-4" />
                    Lewat (Pass)
                  </button>

                  <button
                    type="button"
                    onClick={handlePlaySelectedCards}
                    disabled={
                      selectedCardIds.length === 0 ||
                      !beatValidation?.valid ||
                      (!isMyTurn && !beatValidation?.isBomb) ||
                      isSubmitting
                    }
                    className={[
                      "flex items-center gap-2 px-6 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm shadow-lg transition",
                      beatValidation?.isBomb
                        ? "bg-gradient-to-r from-red-500 to-amber-500 text-slate-950 animate-pulse"
                        : "bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 disabled:opacity-40",
                    ].join(" ")}
                  >
                    {beatValidation?.isBomb
                      ? "💣 LEDAKKAN BOM!"
                      : "🃏 Keluarkan Kartu"}
                  </button>
                </div>
              </div>
            )}

            {/* Log Aktivitas Terakhir */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 flex items-center justify-between gap-2">
              <div className="truncate">
                <span className="text-amber-400 font-semibold mr-1.5">
                  Info Meja:
                </span>
                {gameState.logs[gameState.logs.length - 1]}
              </div>
              {gameState.shuffleMeta && (
                <span className="text-[11px] text-emerald-400 font-mono shrink-0 hidden sm:inline">
                  CSPRNG: 0x{gameState.shuffleMeta.entropyHex.slice(0, 8)}
                </span>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal Panduan Aturan & Audit Pengocokan */}
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        shuffleMeta={gameState.shuffleMeta}
        supabaseReady={supabaseReady}
      />
    </div>
  );
}

