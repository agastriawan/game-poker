"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import {
  Check,
  Clock,
  Copy,
  Crown,
  Flame,
  Headphones,
  Home,
  Link2,
  Loader2,
  LogOut,
  MessageSquareMore,
  Mic,
  MicOff,
  Music,
  Palette,
  Play,
  RotateCcw,
  Settings,
  Share2,
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
import WaitingRoomLobby from "./WaitingRoomLobby";
import RotatePrompt from "./RotatePrompt";
import OrientationToggleBtn from "./OrientationToggleBtn";
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
import { useVoiceChat } from "@/lib/game/useVoiceChat";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { GameState, PlayedCombo, PlayerState, TauntEvent } from "@/lib/game/types";

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
      <div className="player-table-slot relative z-30 flex flex-col items-center justify-center h-[46px] lg:h-[72px] w-[125px] sm:w-[190px] shrink-0">
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
      className="player-table-slot relative z-30 flex flex-col items-center justify-center h-[46px] lg:h-[72px] w-[125px] sm:w-[190px] shrink-0 animate-card-throw"
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

function getComboDisplayLabel(combo: PlayedCombo | null): string {
  if (!combo) return "";
  switch (combo.type) {
    case "single":
      return "Single";
    case "double":
      return "Double";
    case "triple":
      return "Triple";
    case "straight_flush":
      return `Seri (${combo.length})`;
    case "full_house":
      return "Full House";
    case "four_of_a_kind":
      return "BOM";
    default:
      return "Kartu";
  }
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isTauntMenuOpen, setIsTauntMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [feltTheme, setFeltTheme] = useState<FeltTheme>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("poker_barudak_theme") as FeltTheme | null;
        if (saved && ["crimson", "emerald", "royal"].includes(saved)) {
          return saved;
        }
      } catch {}
    }
    return "crimson";
  });
  const [bgmOn, setBgmOn] = useState<boolean>(() => soundEngine.isBgmActive());
  const [sfxOn, setSfxOn] = useState<boolean>(() => soundEngine.isSfxActive());
  const [bgmVolume, setBgmVolume] = useState<number>(() => soundEngine.getBgmVolume());
  const [visibleTaunts, setVisibleTaunts] = useState<Record<string, TauntEvent>>(
    {}
  );
  const [customTauntText, setCustomTauntText] = useState<string>("");
  const [customTauntEmoji, setCustomTauntEmoji] = useState<string>("😈");
  const [isBombShaking, setIsBombShaking] = useState<boolean>(false);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(20);

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

  const voice = useVoiceChat({
    roomCode: gameState.roomCode,
    myPlayerId: myPlayer?.id || myPlayerId,
    players: gameState.players,
  });

  useEffect(() => {
    setBgmOn(soundEngine.isBgmActive());
    setSfxOn(soundEngine.isSfxActive());
    setBgmVolume(soundEngine.getBgmVolume());
  }, []);

  useEffect(() => {
    if (voice.micError) {
      setErrorMsg(voice.micError);
    }
  }, [voice.micError]);

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

  // Bersihkan pilihan kartu HANYA saat ronde baru dimulai atau fase permainan berubah
  useEffect(() => {
    setSelectedCardIds([]);
    setErrorMsg(null);
  }, [gameState.roundNumber, gameState.phase]);

  // Jaga agar kartu yang sudah dipilih sebelumnya tetap ada jika masih di tangan
  useEffect(() => {
    if (!myPlayer) return;
    const handCardIds = new Set(myPlayer.hand.map((c) => c.id));
    setSelectedCardIds((prev) => {
      const valid = prev.filter((id) => handCardIds.has(id));
      return valid.length === prev.length ? prev : valid;
    });
  }, [myPlayer?.hand]);

  const gameStateRef = useRef<GameState>(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Batas waktu giliran per orang (20/30/40/50/60 atau 0 = Unlimited) -> Auto-Skip jika habis
  useEffect(() => {
    const current = gameStateRef.current;
    if (current.phase !== "playing" || !current.currentTurnPlayerId) {
      setTurnSecondsLeft(null);
      return;
    }

    const limit = current.turnDurationLimit ?? 20;
    // Jika limit === 0, berarti mode Unlimited / Tanpa Batas Waktu
    if (limit === 0) {
      setTurnSecondsLeft(null);
      return;
    }

    const activePlayer = current.players.find(
      (p) => p.id === current.currentTurnPlayerId
    );
    if (!activePlayer || activePlayer.isBot) {
      setTurnSecondsLeft(limit);
      return;
    }

    setTurnSecondsLeft(limit);
    const turnStartedAt = Date.now();
    let hasTriggeredTimeout = false;

    const interval = setInterval(async () => {
      const elapsedSec = Math.floor((Date.now() - turnStartedAt) / 1000);
      const remaining = Math.max(0, limit - elapsedSec);
      setTurnSecondsLeft(remaining);

      const shouldTriggerNow =
        (isMyTurn && elapsedSec >= limit) ||
        (!isMyTurn && isHost && elapsedSec >= limit + 1);

      if (shouldTriggerNow && !hasTriggeredTimeout) {
        hasTriggeredTimeout = true;
        clearInterval(interval);
        soundEngine.playPassSound();
        setSelectedCardIds([]);
        try {
          const next = await dispatchGameAction(
            "timeout_turn",
            gameStateRef.current,
            {
              playerId: activePlayer.id,
            }
          );
          onStateChange(next);
        } catch {
          // ignore
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [
    gameState.phase,
    gameState.roundNumber,
    gameState.currentTurnPlayerId,
    gameState.turnDurationLimit,
    gameState.trickPile.length,
    isHost,
    isMyTurn,
    onStateChange,
  ]);

  // Efek Getar Haptic saat waktu tersisa <= 10 detik di giliran pemain sendiri
  useEffect(() => {
    if (
      isMyTurn &&
      gameState.phase === "playing" &&
      turnSecondsLeft !== null &&
      turnSecondsLeft > 0 &&
      (turnSecondsLeft === 10 || turnSecondsLeft === 5 || turnSecondsLeft === 3)
    ) {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch {
          // ignore
        }
      }
    }
  }, [isMyTurn, gameState.phase, turnSecondsLeft]);

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

      // Hanya tampilkan jika taunt masih baru (< 10 detik lalu)
      const elapsed = Date.now() - (taunt.timestamp || 0);
      if (elapsed < 10000) {
        soundEngine.playTauntSound(taunt.tauntId);

        setVisibleTaunts((prev) => ({
          ...prev,
          [taunt.senderId]: taunt,
        }));

        if (tauntTimersRef.current[taunt.senderId]) {
          clearTimeout(tauntTimersRef.current[taunt.senderId]);
        }

        const remainingMs = Math.max(500, 10000 - elapsed);
        tauntTimersRef.current[taunt.senderId] = setTimeout(() => {
          setVisibleTaunts((prev) => {
            if (prev[taunt.senderId]?.id !== taunt.id) return prev;
            const copy = { ...prev };
            delete copy[taunt.senderId];
            return copy;
          });
        }, remainingMs);
      }
    }
  }, [gameState.latestTaunt]);

  // Sweeper Interval: bersihkan otomatis semua chat/emot setelah 10 detik secara presisi
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setVisibleTaunts((prev) => {
        let changed = false;
        const next: Record<string, TauntEvent> = {};
        for (const [senderId, t] of Object.entries(prev)) {
          if (now - (t.timestamp || 0) < 10000) {
            next[senderId] = t;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
    setFeltTheme((prev) => {
      const next = prev === "crimson" ? "emerald" : prev === "emerald" ? "royal" : "crimson";
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("poker_barudak_theme", next);
        } catch {}
      }
      return next;
    });
  };

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(gameState.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getInviteUrl = () => {
    if (typeof window === "undefined") {
      return `https://poker-barudak.vercel.app/?room=${gameState.roomCode}`;
    }
    return `${window.location.origin}/?room=${gameState.roomCode}`;
  };

  const handleCopyRoomLink = () => {
    const url = getInviteUrl();
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareInvite = async () => {
    const url = getInviteUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Poker Barudak",
          text: `Ayo mabar Poker Barudak! Klik link untuk langsung gabung ke meja:`,
          url,
        });
      } catch {
        handleCopyRoomLink();
      }
    } else {
      handleCopyRoomLink();
    }
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
    if (!isHost || gameState.players.length >= 4 || isSubmitting) return;
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
    if (!isHost || isSubmitting) return;
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

  const handleUpdateTurnLimit = async (limit: number) => {
    if (!isHost || isSubmitting) return;
    try {
      const next = await dispatchGameAction(
        "update_room_settings",
        gameState,
        { turnDurationLimit: limit }
      );
      onStateChange(next);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Gagal memperbarui batas waktu giliran."
      );
    }
  };

  const handleSaveProfile = async (newName?: string, newAvatarIdx?: number) => {
    if (!myPlayer) return;
    const finalName =
      (newName !== undefined ? newName : myPlayer.name).trim().slice(0, 15) ||
      myPlayer.name;
    const finalAvatarIdx =
      typeof newAvatarIdx === "number" ? newAvatarIdx : myPlayer.seatIndex;

    try {
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("poker_tongkrongan_player_name", finalName);
          sessionStorage.setItem(
            "poker_tongkrongan_avatar_idx",
            String(finalAvatarIdx)
          );
        } catch {}
      }
      const next = await dispatchGameAction(
        "update_player_profile",
        gameState,
        {
          playerId: myPlayer.id,
          name: finalName,
          seatIndex: finalAvatarIdx,
        }
      );
      onStateChange(next);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal memperbarui profil."
      );
    }
  };

  const handleToggleReady = async () => {
    if (!myPlayer || isSubmitting) return;
    soundEngine.playCardClick();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const next = await dispatchGameAction("toggle_ready", gameState, {
        playerId: myPlayer.id,
      });
      onStateChange(next);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal mengubah status Siap."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRound = async () => {
    if (!isHost || gameState.players.length < 2 || isSubmitting) return;
    const unreadyPlayers = gameState.players.filter(
      (p) => !p.isBot && !p.isReady
    );
    if (unreadyPlayers.length > 0) {
      setErrorMsg(
        `Semua pemain harus menekan Siap (Ready) dahulu! Belum siap: ${unreadyPlayers
          .map((p) => p.name)
          .join(", ")}`
      );
      return;
    }

    if (!isHost || gameState.players.length < 2 || isSubmitting) return;
    soundEngine.startBgm();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const next = await dispatchGameAction("start_round", gameState, {
        playerId: myPlayer?.id,
      });
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
        const next = await dispatchGameAction("forfeit_game", gameState, {
          playerId: myPlayer.id,
        });
        onStateChange(next);
      } else {
        onLeaveRoom();
      }
    } catch {
      onLeaveRoom();
    } finally {
      setIsSubmitting(false);
      setIsLeaveConfirmOpen(false);
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
        "ingame-landscape-stage relative flex flex-col justify-between casino-hall-bg text-white select-none",
        gameState.phase === "waiting"
          ? "h-dvh max-h-dvh overflow-y-auto overscroll-y-contain"
          : "h-dvh max-h-dvh overflow-hidden",
        isBombShaking ? "animate-screen-bomb" : "",
      ].join(" ")}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <RotatePrompt />

      {/* DEKORASI CAHAYA RUANGAN GRAND CASINO LOUNGE */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
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
      {/* EFEK LAYAR BERKEDIP MERAH & GETAR SAAT SISA WAKTU <= 10 DETIK    */}
      {/* ================================================================= */}
      {isMyTurn &&
        gameState.phase === "playing" &&
        turnSecondsLeft !== null &&
        turnSecondsLeft <= 10 &&
        turnSecondsLeft > 0 && (
          <div className="pointer-events-none fixed inset-0 z-50 animate-timer-critical-overlay border-4 border-rose-500/60" />
        )}

      {gameState.phase === "waiting" ? (
        <WaitingRoomLobby
          gameState={gameState}
          myPlayer={myPlayer}
          isHost={isHost}
          isSubmitting={isSubmitting}
          voice={voice}
          visibleTaunts={visibleTaunts}
          onDismissTaunt={handleDismissMyTaunt}
          onOpenChat={() => setIsTauntMenuOpen(true)}
          onToggleReady={handleToggleReady}
          onSaveProfile={handleSaveProfile}
          onAddBot={handleAddBot}
          onRemovePlayer={handleRemovePlayer}
          onUpdateTurnLimit={handleUpdateTurnLimit}
          onStartGame={handleStartRound}
          onLeaveRoom={() => setIsLeaveConfirmOpen(true)}
          onOpenRules={() => setIsRulesOpen(true)}
          bgmOn={bgmOn}
          onToggleBgm={handleToggleBgm}
          sfxOn={sfxOn}
          onToggleSfx={handleToggleSfx}
          copiedCode={copiedCode}
          copiedLink={copiedLink}
          onCopyCode={handleCopyRoomCode}
          onShareInvite={handleShareInvite}
        />
      ) : (
        <>
          {/* ================================================================= */}
      {/* FLOATING SINGLE SETTINGS BUTTON (PENGGANTI NAVBAR)                */}
      {/* ================================================================= */}
      <div className="absolute right-3 z-40 flex items-center gap-2" style={{ top: "max(1.5rem, env(safe-area-inset-top))" }}>
        <OrientationToggleBtn variant="icon" />
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

                    {/* Pengatur Volume Musik (BGM) */}
                    {bgmOn && (
                      <div className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 mt-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                          <span className="flex items-center gap-1 text-amber-300">
                            <Volume2 className="w-3 h-3" /> Volume Backsound
                          </span>
                          <span className="text-amber-400">{Math.round(bgmVolume * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round(bgmVolume * 100)}
                          onChange={(e) => {
                            const val = Number(e.target.value) / 100;
                            setBgmVolume(val);
                            soundEngine.setBgmVolume(val);
                          }}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                        />
                      </div>
                    )}

                    <div className="pt-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Orientasi Layar Handphone
                      </div>
                      <OrientationToggleBtn variant="pill" size="sm" className="w-full justify-center" />
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
          {/* KURSI LAWAN ATAS (KARAKTER 3D BESAR BERADA DI BELAKANG MEJA) */}
          <div className="top-seat-container flex justify-center items-center shrink-0 pt-0.5 sm:pt-1 -mb-1 sm:-mb-4 lg:-mb-6 z-10">
            {seatAssignments.top ? (
              <PlayerSeat3D
                player={seatAssignments.top}
                position="top"
                isHost={gameState.hostId === seatAssignments.top.id}
                isCurrentTurn={
                  gameState.phase === "playing" &&
                  gameState.currentTurnPlayerId === seatAssignments.top.id
                }
                turnSecondsLeft={
                  gameState.phase === "playing" &&
                  gameState.currentTurnPlayerId === seatAssignments.top.id
                    ? turnSecondsLeft
                    : null
                }
                activeTaunt={visibleTaunts[seatAssignments.top.id] || null}
                isMicOn={Boolean(voice.peerMicOn[seatAssignments.top.id])}
                isSpeaking={Boolean(voice.peerSpeaking[seatAssignments.top.id])}
              />
            ) : null}
          </div>

          {/* CONTAINER MEJA 3D + KURSI KIRI & KANAN */}
          <div className="relative w-full flex items-center justify-center">
            {/* KURSI LAWAN KIRI (POSISI LEBIH KE ATAS AGAR NAMA, POIN & KARTU TIDAK TERPOTONG) */}
            {seatAssignments.left && (
              <div className="side-seat-left flex absolute left-0 sm:left-1 lg:left-4 top-[30%] sm:top-[32%] -translate-y-1/2 z-20">
                <PlayerSeat3D
                  player={seatAssignments.left}
                  position="left"
                  isHost={gameState.hostId === seatAssignments.left.id}
                  isCurrentTurn={
                    gameState.phase === "playing" &&
                    gameState.currentTurnPlayerId === seatAssignments.left.id
                  }
                  turnSecondsLeft={
                    gameState.phase === "playing" &&
                    gameState.currentTurnPlayerId === seatAssignments.left.id
                      ? turnSecondsLeft
                      : null
                  }
                  activeTaunt={visibleTaunts[seatAssignments.left.id] || null}
                  isMicOn={Boolean(voice.peerMicOn[seatAssignments.left.id])}
                  isSpeaking={Boolean(
                    voice.peerSpeaking[seatAssignments.left.id]
                  )}
                />
              </div>
            )}

            {/* KURSI LAWAN KANAN (POSISI LEBIH KE ATAS AGAR NAMA, POIN & KARTU TIDAK TERPOTONG) */}
            {seatAssignments.right && (
              <div className="side-seat-right flex absolute right-0 sm:right-1 lg:right-4 top-[30%] sm:top-[32%] -translate-y-1/2 z-20">
                <PlayerSeat3D
                  player={seatAssignments.right}
                  position="right"
                  isHost={gameState.hostId === seatAssignments.right.id}
                  isCurrentTurn={
                    gameState.phase === "playing" &&
                    gameState.currentTurnPlayerId === seatAssignments.right.id
                  }
                  turnSecondsLeft={
                    gameState.phase === "playing" &&
                    gameState.currentTurnPlayerId === seatAssignments.right.id
                      ? turnSecondsLeft
                      : null
                  }
                  activeTaunt={visibleTaunts[seatAssignments.right.id] || null}
                  isMicOn={Boolean(voice.peerMicOn[seatAssignments.right.id])}
                  isSpeaking={Boolean(
                    voice.peerSpeaking[seatAssignments.right.id]
                  )}
                />
              </div>
            )}

            {/* ============================================================= */}
            {/* MEJA KASINO OVAL 3D PERSPEKTIF (UKURAN FIXED BESAR & STABIL)  */}
            {/* ============================================================= */}
            <div className="perspective-stage w-full max-w-5xl mx-auto px-6 sm:px-16 lg:px-28">
              <div className="table-3d-rim w-full rounded-[85px] sm:rounded-[155px] p-1.5 sm:p-2.5 lg:p-3.5 border-2 border-amber-400/50">
                <div
                  className={[
                    "relative w-full rounded-[75px] sm:rounded-[142px] border border-amber-300/40 flex flex-col items-center justify-center px-3 sm:px-10 py-1 sm:py-2 lg:py-3 shadow-inner",
                    gameState.phase === "round_end"
                      ? "h-auto min-h-[140px] sm:min-h-[155px] lg:h-[250px] overflow-visible round-end-felt"
                      : "h-[155px] lg:h-[250px] overflow-hidden",
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
                        <div className="table-cards-left flex-1 flex justify-start">
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
                            <div
                              className={[
                                "px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold shadow-lg flex items-center justify-center transition-colors",
                                turnSecondsLeft !== null && turnSecondsLeft <= 10
                                  ? "bg-rose-950/95 border-rose-400 text-rose-200 animate-pulse ring-2 ring-rose-500/50"
                                  : "bg-slate-950/90 border-amber-400/60 text-amber-300",
                              ].join(" ")}
                            >
                              GILIRANMU{" "}
                              {turnSecondsLeft !== null ? `• ${turnSecondsLeft}s` : ""}
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
                        <div className="table-cards-right flex-1 flex justify-end">
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
                      <div className="round-summary-card relative z-30 w-full max-w-xs sm:max-w-md bg-slate-950/95 border-2 border-amber-400 rounded-xl sm:rounded-2xl p-2 sm:p-3 text-center space-y-1 sm:space-y-2 shadow-2xl animate-taunt-pop">
                        {gameState.roundSummary.endReason === "bomb" &&
                        gameState.roundSummary.bombResolution ? (
                          <div className="space-y-0.5 bg-red-950/70 border border-red-500/50 rounded-xl p-1.5 sm:p-2">
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
                          <div className="text-[11px] sm:text-sm font-black text-amber-300 flex items-center justify-center gap-1">
                            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />{" "}
                            <span>Juara 1: {gameState.roundSummary.nextStarterName}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-1 text-[10px] sm:text-[11px]">
                          {gameState.roundSummary.rankings.map((r) => (
                            <div
                              key={r.playerId}
                              className="flex items-center justify-between px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-slate-900 border border-slate-800"
                            >
                              <span className="font-bold truncate max-w-[85px] sm:max-w-none">
                                {r.playerName}
                              </span>
                              <span
                                className={[
                                  "font-mono font-black ml-1 shrink-0",
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

                        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-0.5 sm:pt-1">
                          {isHost && (
                            <button
                              onClick={handleStartRound}
                              disabled={isSubmitting}
                              className="px-3.5 sm:px-5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-[11px] sm:text-xs shadow-lg transition active:scale-95"
                            >
                              🚀 Main Lagi
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={onLeaveRoom}
                            className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-[11px] sm:text-xs shadow transition active:scale-95"
                          >
                            <Home className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                            <span>Kembali ke Main Menu</span>
                          </button>
                        </div>
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
              <div className="pointer-events-none absolute -top-24 sm:-top-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 whitespace-nowrap">
                <span className="px-3 py-0.5 rounded-full bg-rose-950/95 border border-rose-500 text-rose-200 text-[11px] font-bold shadow-lg">
                  ⚠️ {errorMsg}
                </span>
              </div>
            )}

            {/* Container Dock Bawah: Layla di Kiri, Kartu di Samping Kanannya */}
            <div
              className={[
                "relative bg-slate-950/90 border border-amber-500/30 rounded-2xl px-2 sm:px-3.5 py-1.5 backdrop-blur-md shadow-2xl transition-all",
                isMyTurn &&
                turnSecondsLeft !== null &&
                turnSecondsLeft <= 10 &&
                turnSecondsLeft > 0
                  ? "animate-timer-subtle-shake border-rose-500/80 shadow-[0_0_25px_rgba(239,68,68,0.4)]"
                  : "",
              ].join(" ")}
            >

              {/* Jika Pemain Menyerah / Keluar: Tampilkan Status Kalah & Tombol Kembali ke Main Menu */}
              {myPlayer.isForfeited ? (
                <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-900/90 border border-rose-500/50 rounded-2xl text-center sm:text-left shadow-lg my-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-xl shrink-0">
                      🏳️
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-black text-rose-300">
                        Kamu telah keluar dari permainan ini
                      </div>
                      <div className="text-[11px] text-slate-300">
                        Dinyatakan kalah di posisi{" "}
                        <span className="font-bold text-amber-300">
                          #{myPlayer.finishRank}
                        </span>{" "}
                        (-10 pts). Permainan tetap berlanjut untuk pemain lain.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onLeaveRoom}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition transform active:scale-95 shrink-0"
                  >
                    <Home className="w-4 h-4" />
                    <span>Kembali ke Main Menu</span>
                  </button>
                </div>
              ) : (
                /* KONTEN DOCK: KARTU 100% DI TENGAH LAYAR & DOCK, SELENA DI KIRI, CONTROLS DI KANAN */
                <div className="bottom-dock-container relative flex items-center justify-center w-full min-h-[96px] sm:min-h-[104px]">
                  {/* SISI KIRI: AVATAR 3D SELENA + NAMEPLATE (ANCHORED ABSOLUTE LEFT) */}
                  <div className="absolute left-1 sm:left-2 bottom-0.5 z-20 flex items-end">
                    <PlayerSeat3D
                      player={myPlayer}
                      position="bottom"
                      isHost={gameState.hostId === myPlayer.id}
                      isCurrentTurn={isMyTurn}
                      turnSecondsLeft={isMyTurn ? turnSecondsLeft : null}
                      isMe
                      activeTaunt={visibleTaunts[myPlayer.id] || null}
                      onDismissTaunt={handleDismissMyTaunt}
                      isMicOn={voice.micEnabled}
                      isSpeaking={Boolean(voice.peerSpeaking[myPlayer.id])}
                    />
                  </div>

                  {/* SISI TENGAH: KARTU DI TANGAN (100% TRUE CENTER DI TENGAH DOCK & LAYAR) */}
                  <div className="relative z-10 flex items-center justify-center max-w-[calc(100%-180px)] sm:max-w-[calc(100%-240px)]">
                    <div className="relative inline-flex flex-col items-center">
                      {/* TOMBOL AKSI UTAMA DI ATAS KARTU (LEWAT & BANTING KARTU) - DILETAKKAN CUKUP TINGGI AGAR TIDAK TERTUTUP KARTU */}
                      {gameState.phase === "playing" && !myPlayer.isForfeited && (
                        <div className="action-buttons-bar absolute -top-[68px] sm:-top-[78px] lg:-top-[84px] left-1/2 -translate-x-1/2 z-50 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-2xl bg-slate-950/95 border-2 border-amber-400/60 shadow-[0_12px_32px_rgba(0,0,0,0.95)] backdrop-blur-md whitespace-nowrap">
                          {/* Tombol Lewat */}
                          <button
                            type="button"
                            onClick={handlePassTurn}
                            disabled={
                              gameState.phase !== "playing" ||
                              !isMyTurn ||
                              !gameState.currentTablePlay ||
                              isSubmitting
                            }
                            className={[
                              "flex items-center gap-1 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl border text-[11px] sm:text-xs font-black shadow-md transition transform active:scale-95",
                              isMyTurn && gameState.currentTablePlay
                                ? "bg-slate-800 hover:bg-rose-950/80 border-slate-600 hover:border-rose-500/60 text-slate-200 cursor-pointer"
                                : "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed opacity-40",
                            ].join(" ")}
                          >
                            <SkipForward className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            <span>Lewat</span>
                          </button>

                          {/* Tombol Banting Kartu / BOM */}
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
                              "flex items-center gap-1.5 px-3.5 sm:px-5 py-1 sm:py-1.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl transition transform active:scale-95",
                              beatValidation?.isBomb
                                ? "bg-gradient-to-r from-red-600 via-amber-400 to-red-600 text-slate-950 animate-pulse border-2 border-yellow-300 ring-2 ring-red-500 cursor-pointer"
                                : beatValidation?.valid && (isMyTurn || beatValidation?.isBomb)
                                ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:from-amber-300 hover:to-yellow-200 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.5)] border border-amber-300 scale-105 cursor-pointer ring-2 ring-amber-400/40"
                                : "bg-slate-900 border border-slate-700/80 text-slate-400 opacity-60 cursor-not-allowed",
                            ].join(" ")}
                          >
                            {beatValidation?.isBomb ? (
                              <>
                                <Flame className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-950 fill-current animate-bounce" />
                                <span>💣 BOM!</span>
                              </>
                            ) : evaluatedSelectedCombo && beatValidation?.valid ? (
                              <span>
                                🃏 Banting {getComboDisplayLabel(evaluatedSelectedCombo)}
                              </span>
                            ) : (
                              <span>🃏 Banting Kartu</span>
                            )}
                          </button>

                          {/* Tombol Batal Pilihan Kartu */}
                          {selectedCardIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedCardIds([])}
                              title="Batal pilih semua kartu"
                              className="flex items-center gap-1 px-2 py-1 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] sm:text-xs font-bold transition shadow-sm"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span className="hidden sm:inline">Batal</span>
                              <span>({selectedCardIds.length})</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Kartu di Tangan Pemain */}
                        <div
                          className={[
                            "flex items-center justify-center flex-wrap pt-0.5 pb-0.5",
                            myPlayer.hand.length > 14
                              ? "-space-x-3.5 sm:-space-x-2 gap-y-1"
                              : "-space-x-2 sm:-space-x-1 sm:gap-1 gap-y-1",
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
                    </div>
                  </div>

                  {/* SISI KANAN POJOK: KONTROL CHAT, MIC, HEADSET VERTIKAL + ROOM ID VERTIKAL (PROPORSI PAS DI DALAM CARD) */}
                  <div className="bottom-right-controls absolute right-2 sm:right-3.5 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1 sm:gap-1.5">
                    {/* 3 Tombol Vertikal: Ejek, Mic, Speaker */}
                    <div className="flex flex-col items-center gap-1">
                      {/* Tombol Ejek Lawan */}
                      <button
                        type="button"
                        onClick={() => setIsTauntMenuOpen(true)}
                        title="Ejek Lawan & Kirim Emot"
                        className="w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 border border-purple-400/60 shadow flex items-center justify-center transition transform active:scale-95"
                      >
                        <MessageSquareMore className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300" />
                      </button>

                      {/* Tombol Voice Chat Mic On/Off (Icon Only) */}
                      <button
                        type="button"
                        onClick={voice.toggleMic}
                        disabled={voice.isConnectingMic}
                        title={
                          voice.micEnabled
                            ? "Matikan Mikrofon (Mute)"
                            : "Nyalakan Mikrofon untuk Ngobrol"
                        }
                        className={[
                          "w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-lg sm:rounded-xl border shadow flex items-center justify-center transition transform active:scale-95",
                          voice.micEnabled
                            ? voice.peerSpeaking[myPlayer.id]
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-200 text-slate-950 shadow-[0_0_14px_rgba(16,185,129,0.75)] scale-105"
                              : "bg-emerald-950/95 hover:bg-emerald-900 border-emerald-400/80 text-emerald-300"
                            : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300",
                        ].join(" ")}
                      >
                        {voice.isConnectingMic ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-300" />
                        ) : voice.micEnabled ? (
                          <Mic className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        ) : (
                          <MicOff className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400" />
                        )}
                      </button>

                      {/* Tombol Speaker Suara Teman (Icon Only) */}
                      <button
                        type="button"
                        onClick={voice.toggleSpeaker}
                        title={
                          voice.speakerEnabled
                            ? "Bisukan Suara Obrolan Lawan"
                            : "Nyalakan Suara Obrolan Lawan"
                        }
                        className={[
                          "w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-lg sm:rounded-xl border shadow flex items-center justify-center transition transform active:scale-95",
                          voice.speakerEnabled
                            ? "bg-slate-900 hover:bg-slate-800 border-slate-700 text-amber-300"
                            : "bg-rose-950/90 border-rose-500/60 text-rose-300",
                        ].join(" ")}
                      >
                        {voice.speakerEnabled ? (
                          <Headphones className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        ) : (
                          <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Room ID Vertikal di Paling Pojok Kanan Tray */}
                    <div
                      className="flex items-center justify-center select-none py-0.5"
                      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                      title={`Kode Room: ${gameState.roomCode}`}
                    >
                      <span className="font-mono text-[7px] sm:text-[8px] text-amber-400/80 font-black tracking-wider uppercase">
                        #{gameState.roomCode}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
        </>
      )}

      {/* Modal Konfirmasi Keluar / Menyerah */}
      {isLeaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-950 border-2 border-rose-500/70 rounded-2xl p-5 text-center space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.95)] animate-taunt-pop">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-2xl">
              🏳️
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-white">
                {gameState.phase === "waiting" ? "Yakin Ingin Keluar dari Ruangan?" : "Yakin Ingin Keluar dari Meja?"}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {gameState.phase === "waiting" ? (
                "Kamu akan kembali ke menu utama."
              ) : (
                <>
                  Jika kamu keluar sekarang, kamu otomatis dinyatakan{" "}
                  <strong className="text-rose-400">KALAH (-10 pts)</strong> pada
                  permainan ini!
                </>
              )}
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
                {isSubmitting ? "Keluar..." : gameState.phase === "waiting" ? "Ya, Keluar" : "Ya, Keluar (Kalah)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ejek Lawan & Kirim Emot Meja (Root Viewport - Tidak Pernah Terpotong) */}
      {isTauntMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4"
          onClick={() => setIsTauntMenuOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-950 border-2 border-amber-400 rounded-3xl p-4 sm:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] space-y-4 animate-taunt-pop max-h-[92vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xl">😈</span>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                    Ejek Lawan & Kirim Emot
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Kirim emot kilat 1-klik atau ketik ejekan custom
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTauntMenuOpen(false)}
                className="w-7 h-7 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* SEKSI 1: KIRIM EMOT CEPAT (1-KLIK LANGSUNG MUNCUL DI AVATAR) */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                <span>⚡ Kirim Emot Kilat (1-Klik)</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5 bg-slate-900/90 p-2 sm:p-2.5 rounded-2xl border border-slate-800">
                {[
                  { emo: "😈", label: "Ngejek" },
                  { emo: "😂", label: "Ketawa" },
                  { emo: "🔥", label: "Panas" },
                  { emo: "😜", label: "Melet" },
                  { emo: "🤡", label: "Badut" },
                  { emo: "💀", label: "Mampus" },
                  { emo: "👑", label: "Sultan" },
                  { emo: "💣", label: "BOM" },
                  { emo: "😭", label: "Nangis" },
                  { emo: "💸", label: "Cuan" },
                  { emo: "😎", label: "Santai" },
                  { emo: "🤫", label: "Diem" },
                ].map(({ emo, label }) => (
                  <button
                    key={emo}
                    type="button"
                    onClick={() => {
                      handleSendTaunt("emoji_only", undefined, emo);
                    }}
                    title={`Kirim emot ${label}`}
                    className="group relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl bg-slate-950/70 hover:bg-amber-400/20 border border-slate-800 hover:border-amber-400 text-2xl transition transform hover:scale-110 active:scale-95"
                  >
                    <span className="transition group-hover:animate-bounce">
                      {emo}
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 group-hover:text-amber-300 transition">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* SEKSI 2: KATA-KATA EJEKAN PRESET (1-KLIK) */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1">
                <span>💬 Ejekan Siap Pakai</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {TAUNT_PRESETS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSendTaunt(t.id)}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/90 hover:bg-gradient-to-r hover:from-purple-900/50 hover:to-indigo-900/50 border border-slate-800 hover:border-purple-400 text-left transition transform active:scale-95"
                  >
                    <span className="text-xl shrink-0">{t.emoji}</span>
                    <span className="text-[11px] font-bold text-slate-200 leading-tight">
                      {t.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* SEKSI 3: KETIK EJEKAN CUSTOM SENDIRI */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>✍️ Ketik Ejekan Sendiri</span>
                <span className="text-[9px] font-mono text-slate-500">
                  {customTauntText.length}/60
                </span>
              </div>
              <form onSubmit={handleCustomTauntSubmit} className="space-y-2">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const emojis = ["😈", "😂", "🔥", "😜", "🤡", "💀", "👑", "💣"];
                      const nextIdx = (emojis.indexOf(customTauntEmoji) + 1) % emojis.length;
                      setCustomTauntEmoji(emojis[nextIdx]);
                    }}
                    title="Ganti Emot"
                    className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 flex items-center justify-center text-xl transition shrink-0"
                  >
                    {customTauntEmoji}
                  </button>
                  <input
                    type="text"
                    maxLength={60}
                    value={customTauntText}
                    onChange={(e) => setCustomTauntText(e.target.value)}
                    placeholder="Ketik ejekanmu di sini..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-400 focus:outline-none text-xs text-white font-medium placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={!customTauntText.trim()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition transform active:scale-95 shrink-0"
                  >
                    Kirim
                  </button>
                </div>
              </form>
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
