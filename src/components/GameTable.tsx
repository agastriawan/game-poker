"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import {
  Check,
  Copy,
  Crown,
  Flame,
  LogOut,
  MessageSquareMore,
  Music,
  Palette,
  Play,
  RotateCcw,
  Settings,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Trophy,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import PlayingCard from "./PlayingCard";
import PlayerSeat3D from "./PlayerSeat3D";
import RulesModal from "./RulesModal";
import { soundEngine } from "@/lib/audio/sound-engine";
import { getNextBotAction } from "@/lib/game/bot";
import { TAUNT_PRESETS } from "@/lib/game/engine";
import {
  canBeatPlay,
  checkPokerLastCardViolation,
  evaluateCombo,
  findAllBombsInHand,
} from "@/lib/game/rules";
import { dispatchGameAction } from "@/lib/game/room-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { GameState, PlayerState, TauntEvent } from "@/lib/game/types";

function PlayerTableSlot({
  player,
  gameState,
}: {
  player: PlayerState;
  gameState: GameState;
  isMe?: boolean;
}) {
  // Hanya ambil kartu yang dikeluarkan pemain ini pada 1 putaran (trick) yang sedang berjalan
  const trickPlays = useMemo(
    () => gameState.trickPile.filter((tp) => tp.playerId === player.id),
    [gameState.trickPile, player.id]
  );

  const latestPlay =
    trickPlays.length > 0 ? trickPlays[trickPlays.length - 1] : null;

  const isHighestActive =
    !!latestPlay &&
    gameState.currentTablePlay?.playerId === player.id &&
    gameState.currentTablePlay?.timestamp === latestPlay.timestamp;

  if (!latestPlay) {
    return (
      <div className="flex flex-col items-center justify-center h-[46px] lg:h-[72px] w-[125px] sm:w-[190px] shrink-0">
        {player.hasPassedThisTrick ? (
          <div className="px-2.5 py-0.5 rounded-full bg-slate-950/85 border border-rose-500/50 text-[9px] sm:text-[10px] font-black text-rose-300">
            PASS
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      key={latestPlay.timestamp}
      className="relative flex flex-col items-center justify-center h-[46px] lg:h-[72px] w-[125px] sm:w-[190px] shrink-0 animate-card-throw"
    >
      {/* Deretan Kartu yang Dibuang pada Putaran Ini di Depan Meja Masing-Masing */}
      <div
        className={[
          "relative flex items-center justify-center -space-x-1.5 sm:-space-x-1 py-0.5 px-1.5 rounded-lg transition-all",
          isHighestActive
            ? "ring-2 ring-amber-400 bg-amber-500/20 shadow-[0_0_16px_rgba(245,158,11,0.5)] scale-100"
            : "opacity-80 scale-95",
        ].join(" ")}
      >
        {latestPlay.combo.cards.map((card) => (
          <PlayingCard key={card.id} card={card} size="xs" disabled />
        ))}

        {player.hasPassedThisTrick && !isHighestActive && (
          <span className="absolute -top-2 -right-2 px-1.5 py-0.2 rounded-full bg-slate-950 border border-rose-500/60 text-rose-300 font-black text-[8px]">
            PASS
          </span>
        )}
      </div>
    </div>
  );
}

interface GameTableProps {
  gameState: GameState;
  myPlayerId: string;
  onStateChange: (nextState: GameState) => void;
  onLeaveRoom: () => void;
}

const BOT_NAMES = ["Bot Himiya", "Bot Riko", "Bot Sari", "Bot Dodi"];

type FeltTheme = "crimson" | "emerald" | "royal";

export default function GameTable({
  gameState,
  myPlayerId,
  onStateChange,
  onLeaveRoom,
}: GameTableProps) {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isTauntMenuOpen, setIsTauntMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [feltTheme, setFeltTheme] = useState<FeltTheme>("crimson");
  const [bgmOn, setBgmOn] = useState<boolean>(true);
  const [sfxOn, setSfxOn] = useState<boolean>(true);
  const [visibleTaunts, setVisibleTaunts] = useState<Record<string, TauntEvent>>(
    {}
  );
  const [customTauntText, setCustomTauntText] = useState<string>("");
  const [customTauntEmoji, setCustomTauntEmoji] = useState<string>("😈");
  const [isBombShaking, setIsBombShaking] = useState<boolean>(false);

  const lastPlayedTimestampRef = useRef<number>(0);
  const lastTauntIdRef = useRef<string>("");
  const tauntTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );

  const supabaseReady = isSupabaseConfigured();

  const myPlayer = useMemo(
    () =>
      gameState.players.find((p) => p.id === myPlayerId) ||
      gameState.players[0],
    [gameState.players, myPlayerId]
  );

  const isHost = gameState.hostId === myPlayer?.id;
  const isMyTurn =
    gameState.phase === "playing" &&
    gameState.currentTurnPlayerId === myPlayer?.id;

  // Nyalakan BGM otomatis pada interaksi pertama di meja
  useEffect(() => {
    soundEngine.startBgm();
    return () => {
      soundEngine.stopBgm();
    };
  }, []);

  // Cegah keluar tidak sengaja saat tombol Refresh atau Back ditekan & paksa orientasi landscape di HP
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Coba kunci orientasi layar ke landscape jika didukung browser HP
    const orientationApi = window.screen?.orientation as
      | (ScreenOrientation & { lock?: (mode: string) => Promise<void> })
      | undefined;
    if (orientationApi?.lock) {
      orientationApi.lock("landscape").catch(() => {
        // Fallback otomatis ditangani oleh CSS .ingame-landscape-stage
      });
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.history.pushState({ pokerInGame: true }, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState({ pokerInGame: true }, "", window.location.href);
      setIsLeaveConfirmOpen(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Bersihkan pilihan kartu saat ronde atau giliran berubah
  useEffect(() => {
    setSelectedCardIds([]);
    setErrorMsg(null);
  }, [gameState.roundNumber, gameState.phase, gameState.currentTurnPlayerId]);

  // Deteksi kartu baru dibanting ke meja -> bunyikan SFX banting kartu
  useEffect(() => {
    if (
      gameState.currentTablePlay &&
      gameState.currentTablePlay.timestamp !== lastPlayedTimestampRef.current
    ) {
      lastPlayedTimestampRef.current = gameState.currentTablePlay.timestamp;
      const isBig =
        gameState.currentTablePlay.combo.length >= 5 ||
        gameState.currentTablePlay.combo.primaryValue === 15;
      soundEngine.playCardSlam(isBig);
    }
  }, [gameState.currentTablePlay]);

  // Deteksi Emot / Taunt baru -> tampilkan balon selama 10 detik per pemain & bunyikan SFX
  useEffect(() => {
    const taunt = gameState.latestTaunt;
    if (taunt && taunt.id !== lastTauntIdRef.current) {
      lastTauntIdRef.current = taunt.id;
      soundEngine.playTauntSound(taunt.tauntId);

      setVisibleTaunts((prev) => ({
        ...prev,
        [taunt.senderId]: taunt,
      }));

      if (tauntTimersRef.current[taunt.senderId]) {
        clearTimeout(tauntTimersRef.current[taunt.senderId]);
      }

      tauntTimersRef.current[taunt.senderId] = setTimeout(() => {
        setVisibleTaunts((prev) => {
          if (prev[taunt.senderId]?.id !== taunt.id) return prev;
          const copy = { ...prev };
          delete copy[taunt.senderId];
          return copy;
        });
      }, 10000);
    }
  }, [gameState.latestTaunt]);

  useEffect(() => {
    const timers = tauntTimersRef.current;
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  const handleDismissMyTaunt = () => {
    if (!myPlayer) return;
    if (tauntTimersRef.current[myPlayer.id]) {
      clearTimeout(tauntTimersRef.current[myPlayer.id]);
    }
    setVisibleTaunts((prev) => {
      const copy = { ...prev };
      delete copy[myPlayer.id];
      return copy;
    });
  };

  // Efek Suara & Confetti saat ronde selesai atau terjadi BOM
  useEffect(() => {
    if (gameState.phase === "round_end" && gameState.roundSummary) {
      if (gameState.roundSummary.endReason === "bomb") {
        soundEngine.playBombExplosion();
        setIsBombShaking(true);
        setTimeout(() => setIsBombShaking(false), 800);
      } else {
        soundEngine.playWinFanfare();
      }

      const myResult = gameState.roundSummary.rankings.find(
        (r) => r.playerId === myPlayer?.id
      );
      if (myResult && myResult.scoreDelta > 0) {
        try {
          confetti({
            particleCount: 85,
            spread: 75,
            origin: { y: 0.55 },
          });
        } catch {
          // ignore
        }
      }
    }
  }, [gameState.phase, gameState.roundSummary, myPlayer?.id]);

  // Otomasi langkah Bot
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
          soundEngine.playPassSound();
          const next = await dispatchGameAction("pass_turn", gameState, {
            playerId: botAction.botId,
          });
          onStateChange(next);
        }
      } catch (err) {
        console.error("Bot step error:", err);
      }
    }, 900);

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
    if (!evaluatedSelectedCombo || !myPlayer) return null;
    const baseCheck = canBeatPlay(evaluatedSelectedCombo, currentTableCombo);
    if (!baseCheck.valid) return baseCheck;

    // Jika bukan BOM, pastikan tidak menaruh atau menyisakan Poker (2) di paling akhir
    if (!baseCheck.isBomb) {
      const lastCardCheck = checkPokerLastCardViolation(
        myPlayer.hand,
        selectedCardsObj
      );
      if (lastCardCheck.violates) {
        return {
          valid: false,
          isBomb: false,
          reason: lastCardCheck.reason,
        };
      }
    }

    return baseCheck;
  }, [evaluatedSelectedCombo, currentTableCombo, myPlayer, selectedCardsObj]);

  const myBombs = useMemo(() => {
    if (!myPlayer || gameState.phase !== "playing") return [];
    return findAllBombsInHand(myPlayer.hand);
  }, [myPlayer, gameState.phase]);

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
    soundEngine.playCardClick();
    setErrorMsg(null);
    setSelectedCardIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleToggleBgm = () => {
    const active = soundEngine.toggleBgm();
    setBgmOn(active);
  };

  const handleToggleSfx = () => {
    const active = soundEngine.toggleSfx();
    setSfxOn(active);
  };

  const handleCycleTheme = () => {
    setFeltTheme((prev) =>
      prev === "crimson" ? "emerald" : prev === "emerald" ? "royal" : "crimson"
    );
  };

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(gameState.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendTaunt = async (
    tauntId: string,
    customText?: string,
    customEmoji?: string
  ) => {
    if (!myPlayer) return;
    setIsTauntMenuOpen(false);
    setCustomTauntText("");
    try {
      const next = await dispatchGameAction("send_taunt", gameState, {
        playerId: myPlayer.id,
        tauntId,
        customText,
        customEmoji,
      });
      onStateChange(next);
    } catch {
      // ignore
    }
  };

  const handleCustomTauntSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customTauntText.trim();
    if (!clean) return;
    handleSendTaunt("custom", clean, customTauntEmoji);
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
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal menghapus pemain."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRound = async () => {
    if (gameState.players.length < 2 || isSubmitting) return;
    soundEngine.startBgm();
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
    soundEngine.playCardSlam(false);
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
    soundEngine.playPassSound();
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

  const handleConfirmForfeitAndLeave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (
        myPlayer &&
        (gameState.phase === "collecting_threes" ||
          gameState.phase === "playing")
      ) {
        await dispatchGameAction("forfeit_game", gameState, {
          playerId: myPlayer.id,
        });
      }
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false);
      setIsLeaveConfirmOpen(false);
      onLeaveRoom();
    }
  };

  // Urutkan lawan relatif terhadap kursi kita (searah jarum jam: Kiri -> Atas -> Kanan)
  const opponents = useMemo(() => {
    if (!myPlayer) return [];
    const myIdx = gameState.players.findIndex((p) => p.id === myPlayer.id);
    const list = [];
    for (let i = 1; i < gameState.players.length; i++) {
      list.push(gameState.players[(myIdx + i) % gameState.players.length]);
    }
    return list;
  }, [gameState.players, myPlayer]);

  // Penempatan kursi lawan di sekeliling meja 3D
  const seatAssignments = useMemo(() => {
    if (opponents.length === 1) {
      return { left: null, top: opponents[0], right: null };
    }
    if (opponents.length === 2) {
      return { left: opponents[0], top: null, right: opponents[1] };
    }
    if (opponents.length >= 3) {
      return {
        left: opponents[0],
        top: opponents[1],
        right: opponents[2],
      };
    }
    return { left: null, top: null, right: null };
  }, [opponents]);

  const myThreesCount = useMemo(() => {
    if (!myPlayer) return 0;
    return myPlayer.hand.filter((c) => c.value === 3).length;
  }, [myPlayer]);

  const feltClass =
    feltTheme === "crimson"
      ? "felt-crimson"
      : feltTheme === "emerald"
      ? "felt-emerald"
      : "felt-royal";

  return (
    <div
      className={[
        "ingame-landscape-stage relative flex flex-col justify-between casino-hall-bg text-white overflow-hidden select-none",
        isBombShaking ? "animate-screen-bomb" : "",
      ].join(" ")}
    >
      {/* DEKORASI RUANGAN GRAND CASINO LOUNGE */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-8 w-20 h-36 bg-gradient-to-b from-amber-500/10 via-stone-800/20 to-transparent border-x border-amber-500/15 blur-[1px]" />
        <div className="absolute top-0 right-8 w-20 h-36 bg-gradient-to-b from-amber-500/10 via-stone-800/20 to-transparent border-x border-amber-500/15 blur-[1px]" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-40 rounded-full bg-amber-500/15 blur-3xl" />

        {/* Partikel Cahaya Emas Mengambang */}
        <div className="absolute top-1/4 left-1/5 w-1.5 h-1.5 rounded-full bg-amber-300 animate-ambient-particle" />
        <div
          className="absolute top-1/3 right-1/4 w-2 h-2 rounded-full bg-purple-400 animate-ambient-particle"
          style={{ animationDelay: "1.2s" }}
        />
        <div
          className="absolute bottom-1/3 left-1/3 w-1.5 h-1.5 rounded-full bg-amber-200 animate-ambient-particle"
          style={{ animationDelay: "2.4s" }}
        />
      </div>

      {/* ================================================================= */}
      {/* FLOATING SINGLE SETTINGS BUTTON (PENGGANTI NAVBAR)                */}
      {/* ================================================================= */}
      <div className="absolute top-3 right-3 z-40">
        <button
          type="button"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          title="Pengaturan, Info Room & Papan Poin"
          className="w-10 h-10 rounded-2xl bg-slate-950/90 hover:bg-slate-900 border-2 border-amber-400/60 shadow-[0_6px_20px_rgba(0,0,0,0.8)] flex items-center justify-center text-amber-300 hover:text-white transition transform hover:scale-105"
        >
          {isSettingsOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Settings className="w-5 h-5" />
          )}
        </button>

        {isSettingsOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4"
            onClick={() => setIsSettingsOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[92%] overflow-y-auto bg-slate-950/95 border-2 border-amber-400/70 rounded-2xl p-3 sm:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.95)] space-y-2.5 animate-taunt-pop"
            >
              {/* Header Modal Pengaturan */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                    Pengaturan & Info Meja
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {supabaseReady ? "🟢 Online" : "🟡 Lokal"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid 2 Kolom Horizontal Agar Muat Penuh di Layar HP Horizontal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Kolom Kiri: Info Room & Kontrol Suara/Tema */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-slate-900 border border-amber-400/40 px-2.5 py-1.5 rounded-xl">
                    <div className="text-xs">
                      <span className="text-slate-400 mr-1">Kode:</span>
                      <span className="font-mono font-black text-amber-300 tracking-wider">
                        {gameState.roomCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyRoomCode}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold transition"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-300">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>

                  {gameState.roundNumber > 0 && (
                    <div className="flex items-center justify-between text-[11px] px-1 text-slate-300">
                      <span>Ronde #{gameState.roundNumber}</span>
                      <span className="font-bold text-amber-300">
                        {gameState.mustCollectThrees
                          ? "Kumpul 3 (3♠ Awal)"
                          : "Juara 1 Jalan Awal"}
                      </span>
                    </div>
                  )}

                  {gameState.shuffleMeta &&
                    gameState.shuffleMeta.redealHistory.length > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 text-[10px] text-amber-200">
                        <RotateCcw className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">
                          Redeal Otomatis:{" "}
                          {gameState.shuffleMeta.redealHistory.length}x
                        </span>
                      </div>
                    )}

                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Suara & Tampilan Meja
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={handleToggleBgm}
                        className={[
                          "flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl border text-[10px] font-bold transition",
                          bgmOn
                            ? "bg-amber-500/20 border-amber-400/60 text-amber-300"
                            : "bg-slate-900 border-slate-800 text-slate-400",
                        ].join(" ")}
                      >
                        <Music className="w-3 h-3" />
                        <span>{bgmOn ? "BGM On" : "BGM Off"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleSfx}
                        className={[
                          "flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl border text-[10px] font-bold transition",
                          sfxOn
                            ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-300"
                            : "bg-slate-900 border-slate-800 text-slate-400",
                        ].join(" ")}
                      >
                        {sfxOn ? (
                          <Volume2 className="w-3 h-3" />
                        ) : (
                          <VolumeX className="w-3 h-3" />
                        )}
                        <span>{sfxOn ? "SFX On" : "SFX Off"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCycleTheme}
                        className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-200 transition"
                      >
                        <Palette className="w-3 h-3 text-fuchsia-400" />
                        <span className="capitalize">{feltTheme}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Kolom Kanan: Klasemen Poin & Tombol Aksi */}
                <div className="flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> Klasemen Poin
                    </div>
                    <div className="space-y-1">
                      {[...gameState.players]
                        .sort((a, b) => b.totalScore - a.totalScore)
                        .map((p, i) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between text-[11px] px-2 py-0.5 rounded-lg bg-slate-900"
                          >
                            <span className="font-bold truncate">
                              #{i + 1} {p.name}
                            </span>
                            <span
                              className={[
                                "font-mono font-extrabold",
                                p.totalScore > 0
                                  ? "text-emerald-400"
                                  : p.totalScore < 0
                                  ? "text-rose-400"
                                  : "text-slate-300",
                              ].join(" ")}
                            >
                              {p.totalScore > 0
                                ? `+${p.totalScore}`
                                : p.totalScore}{" "}
                              pts
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Tombol Panduan Aturan & Keluar Room */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        setIsRulesOpen(true);
                      }}
                      className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 transition"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Aturan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        setIsLeaveConfirmOpen(true);
                      }}
                      className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-rose-950/90 hover:bg-rose-900 border border-rose-500/50 text-[11px] font-bold text-rose-200 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar Meja</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* ARENA UTAMA (HORIZONTAL DI HP & DESKTOP, TIDAK AKAN OVERFLOW)     */}
      {/* ================================================================= */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col justify-between max-w-7xl w-full mx-auto px-2 sm:px-6 py-1 lg:py-1.5">
        {/* ZONA ATAS & TENGAH: KURSI LAWAN (KIRI, ATAS, KANAN) + MEJA OVAL 3D */}
        <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center w-full">
          {/* KURSI LAWAN ATAS */}
          <div className="flex justify-center items-center shrink-0 -mb-2 z-20 scale-90 lg:scale-100">
            {seatAssignments.top ? (
              <PlayerSeat3D
                player={seatAssignments.top}
                position="top"
                isCurrentTurn={
                  gameState.phase === "playing" &&
                  gameState.currentTurnPlayerId === seatAssignments.top.id
                }
                activeTaunt={visibleTaunts[seatAssignments.top.id] || null}
              />
            ) : null}
          </div>

          {/* CONTAINER MEJA 3D + KURSI KIRI & KANAN */}
          <div className="relative w-full flex items-center justify-center">
            {/* KURSI LAWAN KIRI */}
            {seatAssignments.left && (
              <div className="flex absolute left-0.5 lg:left-3 top-1/2 -translate-y-1/2 z-20 scale-90 lg:scale-100">
                <PlayerSeat3D
                  player={seatAssignments.left}
                  position="left"
                  isCurrentTurn={
                    gameState.phase === "playing" &&
                    gameState.currentTurnPlayerId === seatAssignments.left.id
                  }
                  activeTaunt={visibleTaunts[seatAssignments.left.id] || null}
                />
              </div>
            )}

            {/* KURSI LAWAN KANAN */}
            {seatAssignments.right && (
              <div className="flex absolute right-0.5 lg:right-3 top-1/2 -translate-y-1/2 z-20 scale-90 lg:scale-100">
                <PlayerSeat3D
                  player={seatAssignments.right}
                  position="right"
                  isCurrentTurn={
                    gameState.phase === "playing" &&
                    gameState.currentTurnPlayerId === seatAssignments.right.id
                  }
                  activeTaunt={visibleTaunts[seatAssignments.right.id] || null}
                />
              </div>
            )}

            {/* ============================================================= */}
            {/* MEJA KASINO OVAL 3D PERSPEKTIF (UKURAN FIXED BESAR & STABIL)  */}
            {/* ============================================================= */}
            <div className="perspective-stage w-full max-w-5xl mx-auto px-16 sm:px-20 lg:px-28">
              <div className="table-3d-rim w-full rounded-[85px] sm:rounded-[155px] p-1.5 sm:p-2.5 lg:p-3.5 border-2 border-amber-400/50">
                <div
                  className={[
                    "relative w-full h-[155px] lg:h-[250px] rounded-[75px] sm:rounded-[142px] border border-amber-300/40 flex flex-col items-center justify-center px-4 sm:px-10 py-1.5 lg:py-3 shadow-inner overflow-hidden",
                    feltClass,
                  ].join(" ")}
                >
                  {/* Garis Lingkar Dalam Meja Kasino Emas */}
                  <div className="pointer-events-none absolute inset-2 sm:inset-3 rounded-[58px] sm:rounded-[118px] border border-amber-300/20" />

                  {/* Watermark Tengah Meja */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center opacity-15">
                    <img
                      src="/logo.png"
                      alt="Poker Barudak"
                      className="h-16 sm:h-24 w-auto object-contain select-none"
                    />
                  </div>

                  {/* 1. KONTEN MEJA SAAT WAITING (LOBBY MEJA) */}
                  {gameState.phase === "waiting" && (
                    <div className="relative z-10 w-full max-w-md bg-slate-950/90 border border-amber-400/40 rounded-2xl p-3 sm:p-4 text-center space-y-2.5 shadow-2xl">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold">
                        <Users className="w-3 h-3" /> {gameState.players.length}/4 Pemain
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-left">
                        {gameState.players.map((p, i) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px]"
                          >
                            <span className="font-bold truncate">
                              #{i + 1} {p.name}
                            </span>
                            {isHost && p.id !== myPlayer?.id && (
                              <button
                                onClick={() => handleRemovePlayer(p.id)}
                                className="text-slate-400 hover:text-rose-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
                        {gameState.players.length < 4 && (
                          <button
                            onClick={handleAddBot}
                            disabled={isSubmitting}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-400/40 text-[11px] font-bold text-amber-300 transition"
                          >
                            <UserPlus className="w-3 h-3" />+ Bot
                          </button>
                        )}

                        <button
                          onClick={handleStartRound}
                          disabled={
                            gameState.players.length < 2 || isSubmitting
                          }
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs shadow-lg transition"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Mulai
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. KONTEN MEJA SAAT FASE KUMPUL ANGKA 3 */}
                  {gameState.phase === "collecting_threes" && (
                    <div className="relative z-10 w-full max-w-md bg-slate-950/90 border border-amber-400/60 rounded-2xl p-3 text-center space-y-2.5 shadow-2xl">
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase">
                        <Sparkles className="w-3 h-3" /> Kumpul Angka 3
                      </div>

                      {/* Kartu 3 yang sudah terkumpul */}
                      {gameState.collectedThreesPool.length > 0 && (
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {gameState.collectedThreesPool.map((entry) => (
                            <div
                              key={entry.playerId}
                              className={[
                                "px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 animate-card-throw",
                                entry.hasThreeOfSpades
                                  ? "bg-amber-500/25 border-amber-400"
                                  : "bg-slate-900/90 border-slate-700",
                              ].join(" ")}
                            >
                              <span className="font-bold">
                                {entry.playerName}:
                              </span>
                              {entry.cards.length === 0 ? (
                                <span className="text-slate-400 italic">-</span>
                              ) : (
                                <span className="font-black text-amber-300">
                                  {entry.cards
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
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {myPlayer && !myPlayer.hasSubmittedThrees && (
                        <button
                          onClick={handleSubmitThrees}
                          disabled={isSubmitting}
                          className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg transition transform hover:scale-105"
                        >
                          {myThreesCount > 0
                            ? `🃏 Kumpul Angka 3 (${myThreesCount})`
                            : `✅ Lanjut`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* 3. KONTEN MEJA SAAT FASE BERMAIN AKTIF (HISTORI PER MEJA PEMAIN) */}
                  {gameState.phase === "playing" && (
                    <div className="relative z-10 w-full h-full flex flex-col items-center justify-between py-0.5">
                      {/* ZONA ATAS MEJA: HISTORI KARTU PEMAIN ATAS (TOP) */}
                      {seatAssignments.top && (
                        <PlayerTableSlot
                          player={seatAssignments.top}
                          gameState={gameState}
                        />
                      )}

                      {/* ZONA TENGAH MEJA: HISTORI KIRI + STATUS TENGAH + HISTORI KANAN */}
                      <div className="w-full flex items-center justify-between gap-1 sm:gap-2 px-1 sm:px-3">
                        {/* Kiri: Histori Kartu Pemain Kiri */}
                        <div className="flex-1 flex justify-start">
                          {seatAssignments.left && (
                            <PlayerTableSlot
                              player={seatAssignments.left}
                              gameState={gameState}
                            />
                          )}
                        </div>

                        {/* Poros Tengah Meja: Status Giliran & Tombol Darurat BOM */}
                        <div className="shrink-0 flex flex-col items-center justify-center text-center space-y-1">
                          {isMyTurn && (
                            <div className="px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-amber-400/60 text-[10px] font-extrabold text-amber-300 shadow-lg flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> GILIRANMU
                            </div>
                          )}

                          {/* TOMBOL DARURAT BOM POKER JIKA LAWAN KELUARKAN SINGLE 2 */}
                          {canDetonateBombNow && (
                            <div className="bg-gradient-to-r from-red-950 via-red-800 to-red-950 border border-amber-300 rounded-xl px-2.5 py-1 text-center space-y-0.5 shadow-[0_0_20px_rgba(239,68,68,0.85)] animate-bounce">
                              <div className="flex flex-wrap justify-center gap-1">
                                {myBombs.map((bomb, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() =>
                                      handleDetonateBombInstant(
                                        bomb.cards.map((c) => c.id)
                                      )
                                    }
                                    disabled={isSubmitting}
                                    className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-amber-300 to-red-500 text-slate-950 font-black text-[10px] shadow hover:scale-105 transition flex items-center gap-1"
                                  >
                                    <Flame className="w-3 h-3" /> BOM ({bomb.label})
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Kanan: Histori Kartu Pemain Kanan */}
                        <div className="flex-1 flex justify-end">
                          {seatAssignments.right && (
                            <PlayerTableSlot
                              player={seatAssignments.right}
                              gameState={gameState}
                            />
                          )}
                        </div>
                      </div>

                      {/* ZONA BAWAH MEJA: HISTORI KARTU KAMU SENDIRI (BOTTOM) */}
                      {myPlayer && (
                        <PlayerTableSlot
                          player={myPlayer}
                          gameState={gameState}
                          isMe
                        />
                      )}
                    </div>
                  )}

                  {/* 4. KONTEN MEJA SAAT RONDE SELESAI (ROUND END) */}
                  {gameState.phase === "round_end" &&
                    gameState.roundSummary && (
                      <div className="relative z-20 w-full max-w-md bg-slate-950/95 border border-amber-400 rounded-2xl p-3 text-center space-y-2 shadow-2xl animate-taunt-pop">
                        {gameState.roundSummary.endReason === "bomb" &&
                        gameState.roundSummary.bombResolution ? (
                          <div className="space-y-0.5 bg-red-950/70 border border-red-500/50 rounded-xl p-2">
                            <div className="text-[10px] font-black text-amber-300 uppercase">
                              💥 BOM MELEDAK!
                            </div>
                            <div className="text-xs sm:text-sm font-black text-white">
                              {gameState.roundSummary.bombResolution.bomberName}{" "}
                              →{" "}
                              {gameState.roundSummary.bombResolution.victimName}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs sm:text-sm font-black text-amber-300 flex items-center justify-center gap-1">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />{" "}
                            Juara 1: {gameState.roundSummary.nextStarterName}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                          {gameState.roundSummary.rankings.map((r) => (
                            <div
                              key={r.playerId}
                              className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-900 border border-slate-800"
                            >
                              <span className="font-bold truncate">
                                {r.playerName}
                              </span>
                              <span
                                className={[
                                  "font-mono font-black",
                                  r.scoreDelta > 0
                                    ? "text-emerald-400"
                                    : r.scoreDelta < 0
                                    ? "text-rose-400"
                                    : "text-slate-400",
                                ].join(" ")}
                              >
                                {r.scoreDelta > 0
                                  ? `+${r.scoreDelta}`
                                  : r.scoreDelta}
                              </span>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={handleStartRound}
                          disabled={isSubmitting}
                          className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs shadow-lg transition"
                        >
                          🚀 Main Lagi
                        </button>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* BAGIAN BAWAH: DOCK KARTU COMPACT & KONTROL AKSI (ZERO-SCROLL)     */}
        {/* ================================================================= */}
        {myPlayer && (
          <div className="relative z-20 shrink-0 pt-1">
            {/* Pill Error Mengambang Ringkas */}
            {errorMsg && (
              <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 whitespace-nowrap">
                <span className="px-3 py-0.5 rounded-full bg-rose-950/95 border border-rose-500 text-rose-200 text-[11px] font-bold shadow-lg">
                  ⚠️ {errorMsg}
                </span>
              </div>
            )}

            {/* Container Dock Bawah */}
            <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl px-2.5 sm:px-4 py-1.5 sm:py-2 backdrop-blur-md shadow-2xl space-y-1.5">
              {/* Baris 1: Kartu di Tangan Pemain (Tegak Lurus, Rapi, Tanpa Scrollbar!) */}
              {gameState.phase !== "waiting" && (
                <div
                  className={[
                    "w-full flex items-center justify-center flex-wrap pt-2 pb-0.5",
                    myPlayer.hand.length > 14
                      ? "-space-x-3 sm:-space-x-1.5 gap-y-1"
                      : "-space-x-1.5 sm:space-x-0 sm:gap-1.5 gap-y-1",
                  ].join(" ")}
                >
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
                </div>
              )}

              {/* Baris 2: Karakter Kita + Tombol Ejek Lawan (Kiri) | Tombol Aksi (Kanan) */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pt-1.5 border-t border-slate-800/80">
                {/* Kiri: Avatar Karakter Pemain + Tombol Emot Ngejek */}
                <div className="flex items-center gap-2">
                  <PlayerSeat3D
                    player={myPlayer}
                    position="bottom"
                    isCurrentTurn={isMyTurn}
                    isMe
                    activeTaunt={visibleTaunts[myPlayer.id] || null}
                    onDismissTaunt={handleDismissMyTaunt}
                  />

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTauntMenuOpen((prev) => !prev)}
                      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 border border-purple-400/60 shadow transition"
                    >
                      <MessageSquareMore className="w-3.5 h-3.5 text-amber-300" />
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-white">
                        Ejek
                      </span>
                    </button>

                    {isTauntMenuOpen && (
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4"
                        onClick={() => setIsTauntMenuOpen(false)}
                      >
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="w-full max-w-md max-h-[90%] overflow-y-auto bg-slate-950/95 border-2 border-amber-400 rounded-2xl p-3 shadow-[0_15px_40px_rgba(0,0,0,0.95)] space-y-2 animate-taunt-pop"
                        >
                          <div className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-1">
                            <span>😈 Ejek Lawan</span>
                            <button
                              type="button"
                              onClick={() => setIsTauntMenuOpen(false)}
                              className="text-slate-400 hover:text-white text-xs px-1"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Form Ketik Ejekan Custom */}
                          <form
                            onSubmit={handleCustomTauntSubmit}
                            className="space-y-1.5"
                          >
                            {/* Pilihan Emot Cepat untuk Custom Text */}
                            <div className="flex items-center justify-between gap-1 bg-slate-900/90 px-2 py-1 rounded-xl border border-slate-800">
                              {[
                                "😈",
                                "😂",
                                "🔥",
                                "😜",
                                "🤡",
                                "💀",
                                "👑",
                                "💣",
                              ].map((emo) => (
                                <button
                                  key={emo}
                                  type="button"
                                  onClick={() => setCustomTauntEmoji(emo)}
                                  className={[
                                    "w-6 h-6 rounded-lg flex items-center justify-center text-sm transition",
                                    customTauntEmoji === emo
                                      ? "bg-amber-400/30 border border-amber-400 scale-110"
                                      : "hover:bg-slate-800 opacity-75 hover:opacity-100",
                                  ].join(" ")}
                                >
                                  {emo}
                                </button>
                              ))}
                            </div>

                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                maxLength={60}
                                autoFocus
                                value={customTauntText}
                                onChange={(e) =>
                                  setCustomTauntText(e.target.value)
                                }
                                placeholder="Ketik ejekanmu..."
                                className="flex-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-400 focus:outline-none text-xs text-white font-semibold"
                              />
                              <button
                                type="submit"
                                disabled={!customTauntText.trim()}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs transition shrink-0"
                              >
                                Kirim
                              </button>
                            </div>
                          </form>

                          {/* Preset Ejekan Cepat 1-Klik */}
                          <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-800">
                            {TAUNT_PRESETS.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => handleSendTaunt(t.id)}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-slate-900 hover:bg-purple-900/60 border border-slate-800 hover:border-amber-400/60 text-left transition"
                              >
                                <span className="text-base leading-none">
                                  {t.emoji}
                                </span>
                                <span className="text-[10px] font-bold text-slate-100 leading-tight">
                                  {t.text}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Kanan: Tombol Kapsul Aksi (Lewat & Banting Kartu) */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={handlePassTurn}
                    disabled={
                      gameState.phase !== "playing" ||
                      !isMyTurn ||
                      !gameState.currentTablePlay ||
                      isSubmitting
                    }
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-rose-950 disabled:opacity-40 border border-slate-600 text-[11px] font-extrabold text-slate-200 shadow transition"
                  >
                    <SkipForward className="w-3 h-3" />
                    <span>Lewat</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePlaySelectedCards}
                    disabled={
                      gameState.phase !== "playing" ||
                      selectedCardIds.length === 0 ||
                      !beatValidation?.valid ||
                      (!isMyTurn && !beatValidation?.isBomb) ||
                      isSubmitting
                    }
                    className={[
                      "py-1.5 px-4 sm:px-5 rounded-full font-black text-[11px] sm:text-xs uppercase tracking-wider shadow-lg transition transform active:scale-95",
                      beatValidation?.isBomb
                        ? "bg-gradient-to-r from-red-500 via-amber-400 to-red-500 text-slate-950 animate-pulse"
                        : "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 disabled:opacity-35",
                    ].join(" ")}
                  >
                    {beatValidation?.isBomb ? "💣 BOM!" : "🃏 Banting Kartu"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Konfirmasi Keluar / Menyerah */}
      {isLeaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-950 border-2 border-rose-500/70 rounded-2xl p-5 text-center space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.95)] animate-taunt-pop">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-2xl">
              🏳️
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-white">
                Yakin Ingin Keluar dari Meja?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Jika kamu keluar sekarang, kamu otomatis dinyatakan{" "}
                <strong className="text-rose-400">KALAH (-10 pts)</strong> pada
                permainan ini!
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsLeaveConfirmOpen(false)}
                disabled={isSubmitting}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-black text-white transition"
              >
                Lanjut Main
              </button>
              <button
                type="button"
                onClick={handleConfirmForfeitAndLeave}
                disabled={isSubmitting}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-xs font-black text-white shadow-lg transition"
              >
                {isSubmitting ? "Keluar..." : "Ya, Keluar (Kalah)"}
              </button>
            </div>
          </div>
        </div>
      )}

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
