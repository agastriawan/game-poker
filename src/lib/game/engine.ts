import {
  canBeatPlay,
  checkPokerLastCardViolation,
  evaluateCombo,
} from "./rules";
import { dealFairHandsWithRedealCheck } from "./shuffle";
import {
  BombResolution,
  Card,
  CollectedThreeEntry,
  GameState,
  PlayerState,
  RoundSummary,
} from "./types";

/**
 * Tabel poin berdasarkan jumlah pemain untuk ronde yang berakhir normal:
 * - 4 Pemain: Juara 1 (+30), Juara 2 (+20), Juara 3 (+10), Kalah Terakhir (-10)
 * - 3 Pemain: Juara 1 (+20), Juara 2 (+10), Kalah Terakhir (-10)
 * - 2 Pemain: Juara 1 (+20), Kalah Terakhir (-10)
 */
export function getNormalScoreByRank(numPlayers: number, rank: number): number {
  if (numPlayers === 4) {
    if (rank === 1) return 30;
    if (rank === 2) return 20;
    if (rank === 3) return 10;
    return -10;
  }
  if (numPlayers === 3) {
    if (rank === 1) return 20;
    if (rank === 2) return 10;
    return -10;
  }
  // 2 Pemain
  if (rank === 1) return 20;
  return -10;
}

/**
 * Membuat state awal Room baru.
 */
export function createInitialGameState(params: {
  roomCode: string;
  hostId: string;
  hostName: string;
}): GameState {
  const hostPlayer: PlayerState = {
    id: params.hostId,
    name: params.hostName,
    isBot: false,
    seatIndex: 0,
    hand: [],
    hasSubmittedThrees: false,
    collectedThrees: [],
    hasPassedThisTrick: false,
    finishRank: null,
    totalScore: 0,
    lastRoundDelta: 0,
  };

  return {
    roomCode: params.roomCode.toUpperCase(),
    hostId: params.hostId,
    phase: "waiting",
    roundNumber: 0,
    mustCollectThrees: true,
    previousWinnerId: null,
    players: [hostPlayer],
    currentTurnPlayerId: null,
    currentTablePlay: null,
    trickPile: [],
    roundPlays: [],
    collectedThreesPool: [],
    finishedOrder: [],
    roundSummary: null,
    shuffleMeta: null,
    previousHandsSignature: {},
    logs: [`Room ${params.roomCode.toUpperCase()} dibuat oleh ${params.hostName}.`],
    updatedAt: Date.now(),
  };
}

/**
 * Menambahkan pemain atau Bot ke dalam Room (maksimal 4 pemain).
 */
export function addPlayerToGame(
  state: GameState,
  player: { id: string; name: string; isBot: boolean }
): GameState {
  if (state.players.some((p) => p.id === player.id)) {
    return state;
  }
  if (state.players.length >= 4) {
    throw new Error("Room sudah penuh (maksimal 4 pemain).");
  }
  if (state.phase !== "waiting") {
    throw new Error("Permainan sedang berlangsung.");
  }

  const newPlayer: PlayerState = {
    id: player.id,
    name: player.name,
    isBot: player.isBot,
    seatIndex: state.players.length,
    hand: [],
    hasSubmittedThrees: false,
    collectedThrees: [],
    hasPassedThisTrick: false,
    finishRank: null,
    totalScore: 0,
    lastRoundDelta: 0,
  };

  return {
    ...state,
    players: [...state.players, newPlayer],
    logs: [...state.logs.slice(-19), `${player.name} bergabung ke meja.`],
    updatedAt: Date.now(),
  };
}

/**
 * Menghapus pemain/bot dari lobby saat masih di fase waiting.
 */
export function removePlayerFromGame(
  state: GameState,
  playerId: string
): GameState {
  if (state.phase !== "waiting") return state;
  const filtered = state.players
    .filter((p) => p.id !== playerId)
    .map((p, idx) => ({ ...p, seatIndex: idx }));

  return {
    ...state,
    players: filtered,
    updatedAt: Date.now(),
  };
}

/**
 * Memulai ronde baru:
 * - Mengocok 52 kartu dengan CSPRNG + Riffle/Cut + Anti-Similarity Guard.
 * - Mengecek kondisi Kocok Ulang (Tidak punya J/Q/K atau 1 orang pegang 4 Poker).
 * - Jika terjadi Kocok Ulang, atau Ronde 1, atau habis kena Bom -> Masuk fase "collecting_threes" (Kumpul Angka 3).
 * - Jika ronde sebelumnya berakhir normal tanpa Kocok Ulang -> Juara 1 langsung jalan bebas tanpa kumpul angka 3.
 */
export function startNewRound(state: GameState): GameState {
  if (state.players.length < 2 || state.players.length > 4) {
    throw new Error("Permainan membutuhkan 2 hingga 4 pemain.");
  }

  const nextRoundNumber = state.roundNumber + 1;

  // Tentukan siapa yang menerima pembagian kartu pertama (untuk 3 pemain, penerima pertama dapat 18 kartu)
  let startDealIndex = 0;
  if (state.previousWinnerId) {
    const winnerIdx = state.players.findIndex(
      (p) => p.id === state.previousWinnerId
    );
    if (winnerIdx !== -1) startDealIndex = winnerIdx;
  } else {
    startDealIndex = (nextRoundNumber - 1) % state.players.length;
  }

  const dealResult = dealFairHandsWithRedealCheck({
    players: state.players.map((p) => ({ id: p.id, name: p.name })),
    roundNumber: nextRoundNumber,
    previousHandsSignature: state.previousHandsSignature,
    startDealIndex,
  });

  // Aturan 5: Jika terjadi kocok ulang karena tidak ada J/Q/K atau ada 4 Poker di 1 tangan,
  // maka wajib kembali mengumpulkan angka 3 walaupun sebelumnya ada yang menang!
  const shouldCollectThrees =
    state.mustCollectThrees ||
    dealResult.triggeredRedeal ||
    !state.previousWinnerId;

  const updatedPlayers: PlayerState[] = state.players.map((p) => ({
    ...p,
    hand: dealResult.hands[p.id] || [],
    hasSubmittedThrees: false,
    collectedThrees: [],
    hasPassedThisTrick: false,
    finishRank: null,
    lastRoundDelta: 0,
  }));

  const newLogs = [...state.logs.slice(-15)];

  if (dealResult.shuffleMeta.redealHistory.length > 0) {
    for (const ev of dealResult.shuffleMeta.redealHistory) {
      newLogs.push(`⚠️ KOCOK ULANG: ${ev.description}`);
    }
  }

  if (shouldCollectThrees) {
    newLogs.push(
      `🃏 Ronde #${nextRoundNumber} dimulai! Fase Kumpul Angka 3 — Semua pemain wajib mengeluarkan kartu angka 3. Pemilik 3♠ akan jalan pertama.`
    );
    return {
      ...state,
      phase: "collecting_threes",
      roundNumber: nextRoundNumber,
      mustCollectThrees: true,
      players: updatedPlayers,
      currentTurnPlayerId: null,
      currentTablePlay: null,
      trickPile: [],
      roundPlays: [],
      collectedThreesPool: [],
      finishedOrder: [],
      roundSummary: null,
      shuffleMeta: dealResult.shuffleMeta,
      previousHandsSignature: dealResult.newSignatures,
      logs: newLogs,
      updatedAt: Date.now(),
    };
  } else {
    const starter =
      updatedPlayers.find((p) => p.id === state.previousWinnerId) ||
      updatedPlayers[0];

    newLogs.push(
      `🏆 Ronde #${nextRoundNumber} dimulai! Tanpa kumpul angka 3 — Juara 1 sebelumnya (${starter.name}) bebas jalan pertama.`
    );

    return {
      ...state,
      phase: "playing",
      roundNumber: nextRoundNumber,
      mustCollectThrees: false,
      players: updatedPlayers,
      currentTurnPlayerId: starter.id,
      currentTablePlay: null,
      trickPile: [],
      roundPlays: [],
      collectedThreesPool: [],
      finishedOrder: [],
      roundSummary: null,
      shuffleMeta: dealResult.shuffleMeta,
      previousHandsSignature: dealResult.newSignatures,
      logs: newLogs,
      updatedAt: Date.now(),
    };
  }
}

/**
 * Fase Pembuka: Pemain mengumpulkan seluruh kartu angka 3 miliknya ke meja.
 * Ketika semua pemain sudah mengumpulkan, pemilik 3 Sekop (3♠) otomatis memegang giliran pertama.
 */
export function submitPlayerThrees(
  state: GameState,
  playerId: string
): GameState {
  if (state.phase !== "collecting_threes") {
    return state;
  }

  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return state;

  const targetPlayer = state.players[playerIdx];
  if (targetPlayer.hasSubmittedThrees) return state;

  const threes = targetPlayer.hand.filter((c) => c.value === 3);
  const remainingHand = targetPlayer.hand.filter((c) => c.value !== 3);
  const hasThreeOfSpades = threes.some(
    (c) => c.value === 3 && c.suit === "spades"
  );

  const updatedPlayer: PlayerState = {
    ...targetPlayer,
    hand: remainingHand,
    hasSubmittedThrees: true,
    collectedThrees: threes,
  };

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIdx] = updatedPlayer;

  const entry: CollectedThreeEntry = {
    playerId: targetPlayer.id,
    playerName: targetPlayer.name,
    cards: threes,
    hasThreeOfSpades,
  };

  const updatedPool = [...state.collectedThreesPool, entry];
  const newLogs = [...state.logs.slice(-18)];

  if (threes.length > 0) {
    const cardLabels = threes
      .map((c) => `3${c.suit === "spades" ? "♠" : c.suit === "hearts" ? "♥" : c.suit === "clubs" ? "♣" : "♦"}`)
      .join(", ");
    newLogs.push(
      `${targetPlayer.name} mengumpulkan ${threes.length} kartu tiga (${cardLabels}).`
    );
  } else {
    newLogs.push(`${targetPlayer.name} tidak memegang kartu angka 3.`);
  }

  // Cek apakah semua pemain sudah mengumpulkan angka 3
  const allSubmitted = updatedPlayers.every((p) => p.hasSubmittedThrees);
  if (!allSubmitted) {
    return {
      ...state,
      players: updatedPlayers,
      collectedThreesPool: updatedPool,
      logs: newLogs,
      updatedAt: Date.now(),
    };
  }

  // Semua sudah kumpul angka 3! Cari pemilik 3 Sekop (3♠)
  const threeSpadesEntry = updatedPool.find((e) => e.hasThreeOfSpades);
  const firstPlayerId = threeSpadesEntry
    ? threeSpadesEntry.playerId
    : updatedPlayers[0].id;
  const firstPlayerName =
    updatedPlayers.find((p) => p.id === firstPlayerId)?.name || "Pemain";

  newLogs.push(
    `♠️ ${firstPlayerName} mengeluarkan 3 Sekop (3♠) dan berhak jalan paling awal!`
  );

  return {
    ...state,
    phase: "playing",
    players: updatedPlayers,
    collectedThreesPool: updatedPool,
    currentTurnPlayerId: firstPlayerId,
    currentTablePlay: null,
    trickPile: [],
    logs: newLogs,
    updatedAt: Date.now(),
  };
}

/**
 * Mencari pemain aktif berikutnya yang belum habis kartunya dan belum pass di trick ini.
 */
function findNextActivePlayerId(
  players: PlayerState[],
  currentPlayerId: string,
  ignorePassFlag = false
): string | null {
  const num = players.length;
  const currentIdx = players.findIndex((p) => p.id === currentPlayerId);
  if (currentIdx === -1) return null;

  for (let offset = 1; offset <= num; offset++) {
    const candidate = players[(currentIdx + offset) % num];
    if (candidate.finishRank !== null || candidate.hand.length === 0) {
      continue;
    }
    if (!ignorePassFlag && candidate.hasPassedThisTrick) {
      continue;
    }
    return candidate.id;
  }

  return null;
}

/**
 * Mengeksekusi langkah membuang kartu (baik giliran normal maupun potong BOM atas Single 2).
 */
export function playCards(
  state: GameState,
  playerId: string,
  cardIds: string[]
): GameState {
  if (state.phase !== "playing") {
    throw new Error("Permainan belum berada di fase jalan.");
  }

  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) {
    throw new Error("Pemain tidak ditemukan.");
  }

  const player = state.players[playerIdx];
  if (player.finishRank !== null) {
    throw new Error("Kartu kamu sudah habis di ronde ini.");
  }

  // Ambil objek kartu dari tangan pemain
  const selectedCards: Card[] = [];
  for (const id of cardIds) {
    const found = player.hand.find((c) => c.id === id);
    if (!found) {
      throw new Error("Kartu yang dipilih tidak ada di tangan.");
    }
    selectedCards.push(found);
  }

  const combo = evaluateCombo(selectedCards);
  if (!combo) {
    throw new Error(
      "Kombinasi kartu tidak sah! Gunakan Single, Double, Triple, Seri Sejenis (min. 3 kartu lambang sama), Full House (3+2), atau Bom."
    );
  }

  const currentTableCombo = state.currentTablePlay
    ? state.currentTablePlay.combo
    : null;

  const beatCheck = canBeatPlay(combo, currentTableCombo);
  if (!beatCheck.valid) {
    throw new Error(beatCheck.reason || "Kartu tidak bisa mengalahkan kartu di meja.");
  }

  // Jika bukan langkah BOM, wajib sesuai giliran pemain saat ini & tidak boleh menaruh/menyisakan Poker di paling akhir
  if (!beatCheck.isBomb) {
    if (state.currentTurnPlayerId !== playerId) {
      throw new Error("Belum giliran kamu untuk jalan!");
    }

    const lastCardViolation = checkPokerLastCardViolation(
      player.hand,
      selectedCards
    );
    if (lastCardViolation.violates) {
      throw new Error(
        lastCardViolation.reason ||
          "Kartu Poker (2) tidak boleh ditaruh di paling akhir!"
      );
    }
  }

  // Jika langkah BOM, pastikan pemain yang mengeluarkan Single Poker bukan dirinya sendiri
  if (
    beatCheck.isBomb &&
    state.currentTablePlay &&
    state.currentTablePlay.playerId === playerId
  ) {
    throw new Error("Tidak bisa mengebom kartu Poker milik sendiri!");
  }

  // Kurangi kartu dari tangan pemain
  const selectedSet = new Set(cardIds);
  const remainingHand = player.hand.filter((c) => !selectedSet.has(c.id));

  const newLogs = [...state.logs.slice(-18)];

  // ============================================================================
  // KASUS 1: LANGKAH ADALAH BOM TERHADAP SINGLE POKER (2)!
  // Aturan 4: Permainan langsung berakhir! Pengebom +10, Korban -10, lainnya 0.
  // Game berikutnya kembali mengumpulkan kartu angka 3.
  // ============================================================================
  if (beatCheck.isBomb && state.currentTablePlay) {
    const victimId = state.currentTablePlay.playerId;
    const victimName = state.currentTablePlay.playerName;
    const pokerCard = state.currentTablePlay.combo.cards[0];

    const bombCombo = { ...combo, isBombMove: true };

    const updatedPlayers = state.players.map((p) => {
      let delta = 0;
      if (p.id === playerId) delta = 10;
      else if (p.id === victimId) delta = -10;

      return {
        ...p,
        hand: p.id === playerId ? remainingHand : p.hand,
        lastRoundDelta: delta,
        totalScore: p.totalScore + delta,
      };
    });

    const bombResolution: BombResolution = {
      bomberId: playerId,
      bomberName: player.name,
      victimId,
      victimName,
      bombCombo,
      pokerCard,
    };

    const roundSummary: RoundSummary = {
      roundNumber: state.roundNumber,
      endReason: "bomb",
      bombResolution,
      rankings: updatedPlayers.map((p) => ({
        playerId: p.id,
        playerName: p.name,
        rank: p.id === playerId ? 1 : p.id === victimId ? updatedPlayers.length : null,
        scoreDelta: p.lastRoundDelta,
        newTotalScore: p.totalScore,
        statusLabel:
          p.id === playerId
            ? "💣 PENGEBOM (+10)"
            : p.id === victimId
            ? "💥 KORBAN BOM (-10)"
            : "🛡️ Aman (0)",
      })),
      nextRoundMode: "collect_threes",
      nextStarterId: null,
      nextStarterName: "Pemilik 3 Sekop (3♠)",
    };

    newLogs.push(
      `💣🔥 BOM MELEDAK! ${player.name} mengebom kartu Poker milik ${victimName} menggunakan ${bombCombo.label}! Permainan berakhir! (${player.name} +10, ${victimName} -10).`
    );

    const bombPlayEntry = {
      playerId,
      playerName: player.name,
      combo: bombCombo,
      timestamp: Date.now(),
    };

    const bombTaunt = {
      id: `taunt-bomb-${Date.now()}`,
      senderId: player.id,
      senderName: player.name,
      tauntId: "bomb_warn",
      emoji: "💣",
      text: "Hahaha kena BOM mampus!",
      timestamp: Date.now(),
    };

    return {
      ...state,
      phase: "round_end",
      mustCollectThrees: true,
      previousWinnerId: null,
      players: updatedPlayers,
      currentTurnPlayerId: null,
      currentTablePlay: bombPlayEntry,
      trickPile: [...state.trickPile, bombPlayEntry],
      roundPlays: [...(state.roundPlays || []), bombPlayEntry],
      roundSummary,
      latestTaunt: bombTaunt,
      logs: newLogs,
      updatedAt: Date.now(),
    };
  }

  // ============================================================================
  // KASUS 2: LANGKAH NORMAL
  // ============================================================================
  const newPlayEntry = {
    playerId,
    playerName: player.name,
    combo,
    timestamp: Date.now(),
  };

  let updatedFinishedOrder = [...state.finishedOrder];
  let newFinishRank: number | null = player.finishRank;

  if (remainingHand.length === 0) {
    updatedFinishedOrder.push(playerId);
    newFinishRank = updatedFinishedOrder.length;
    newLogs.push(
      `🎉 ${player.name} mengeluarkan ${combo.label} dan menghabiskan kartu! (Juara #${newFinishRank})`
    );
  } else {
    newLogs.push(`${player.name} mengeluarkan ${combo.label}.`);
  }

  // Ketika ada kartu baru yang sah naik ke meja, pemain lain yang belum habis di-reset status pass-nya
  // sehingga mereka berkesempatan melawan kartu baru ini saat gilirannya tiba
  let updatedPlayers: PlayerState[] = state.players.map((p, idx) => {
    if (idx === playerIdx) {
      return {
        ...p,
        hand: remainingHand,
        finishRank: newFinishRank,
        hasPassedThisTrick: false,
      };
    }
    return {
      ...p,
      hasPassedThisTrick: false,
    };
  });

  // Cek apakah permainan sudah selesai (sisa <= 1 pemain yang masih memegang kartu)
  const stillPlaying = updatedPlayers.filter((p) => p.finishRank === null);
  if (stillPlaying.length <= 1) {
    if (stillPlaying.length === 1) {
      const lastLoser = stillPlaying[0];
      updatedFinishedOrder.push(lastLoser.id);
      const lastRank = updatedFinishedOrder.length;
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === lastLoser.id ? { ...p, finishRank: lastRank } : p
      );
    }

    // Hitung poin akhir ronde normal
    const numPlayers = updatedPlayers.length;
    updatedPlayers = updatedPlayers.map((p) => {
      const rank = p.finishRank || numPlayers;
      const delta = getNormalScoreByRank(numPlayers, rank);
      return {
        ...p,
        lastRoundDelta: delta,
        totalScore: p.totalScore + delta,
      };
    });

    const firstWinnerId = updatedFinishedOrder[0];
    const firstWinnerName =
      updatedPlayers.find((p) => p.id === firstWinnerId)?.name || "Juara 1";

    const roundSummary: RoundSummary = {
      roundNumber: state.roundNumber,
      endReason: "normal",
      rankings: [...updatedPlayers]
        .sort((a, b) => (a.finishRank || 99) - (b.finishRank || 99))
        .map((p) => ({
          playerId: p.id,
          playerName: p.name,
          rank: p.finishRank,
          scoreDelta: p.lastRoundDelta,
          newTotalScore: p.totalScore,
          statusLabel:
            p.finishRank === 1
              ? "🥇 Juara 1"
              : p.finishRank === numPlayers
              ? "💀 Kalah Terakhir"
              : `🏅 Juara ${p.finishRank}`,
        })),
      nextRoundMode: "winner_starts",
      nextStarterId: firstWinnerId,
      nextStarterName: firstWinnerName,
    };

    newLogs.push(
      `🏁 Ronde #${state.roundNumber} selesai! Juara 1: ${firstWinnerName} (akan jalan paling awal di game berikutnya).`
    );

    return {
      ...state,
      phase: "round_end",
      mustCollectThrees: false,
      previousWinnerId: firstWinnerId,
      players: updatedPlayers,
      currentTurnPlayerId: null,
      currentTablePlay: newPlayEntry,
      trickPile: [...state.trickPile, newPlayEntry],
      roundPlays: [...(state.roundPlays || []), newPlayEntry],
      finishedOrder: updatedFinishedOrder,
      roundSummary,
      logs: newLogs,
      updatedAt: Date.now(),
    };
  }

  // Cari pemain berikutnya
  const nextTurnId = findNextActivePlayerId(updatedPlayers, playerId, true);

  let autoBotTaunt = state.latestTaunt;
  if (player.isBot) {
    if (remainingHand.length === 0) {
      autoBotTaunt = {
        id: `taunt-win-${Date.now()}`,
        senderId: player.id,
        senderName: player.name,
        tauntId: "ez",
        emoji: "😎",
        text: "Gampang banget (EZ)!",
        timestamp: Date.now(),
      };
    } else if (combo.type === "full_house" || combo.type === "straight_flush") {
      autoBotTaunt = {
        id: `taunt-combo-${Date.now()}`,
        senderId: player.id,
        senderName: player.name,
        tauntId: "fire",
        emoji: "🔥",
        text: "Senggol dong kombo maut!",
        timestamp: Date.now(),
      };
    } else if (combo.primaryValue === 15) {
      autoBotTaunt = {
        id: `taunt-poker-${Date.now()}`,
        senderId: player.id,
        senderName: player.name,
        tauntId: "laugh",
        emoji: "😂",
        text: "Awas kartu Poker lewat!",
        timestamp: Date.now(),
      };
    }
  }

  return {
    ...state,
    players: updatedPlayers,
    currentTurnPlayerId: nextTurnId,
    currentTablePlay: newPlayEntry,
    trickPile: [...state.trickPile, newPlayEntry],
    roundPlays: [...(state.roundPlays || []), newPlayEntry],
    finishedOrder: updatedFinishedOrder,
    latestTaunt: autoBotTaunt,
    logs: newLogs,
    updatedAt: Date.now(),
  };
}

/**
 * Pemain memilih "Lewat / Pass" pada gilirannya.
 * Jika semua pemain lain sudah lewat, meja dikosongkan dan pemegang kartu tertinggi
 * (atau pemain aktif berikutnya jika dia sudah habis) bebas memulai kombinasi baru!
 */
export function passTurn(state: GameState, playerId: string): GameState {
  if (state.phase !== "playing") {
    throw new Error("Permainan belum berada di fase jalan.");
  }
  if (state.currentTurnPlayerId !== playerId) {
    throw new Error("Belum giliran kamu!");
  }
  if (!state.currentTablePlay) {
    throw new Error(
      "Meja sedang kosong (giliran bebas), kamu wajib mengeluarkan kartu!"
    );
  }

  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return state;

  const player = state.players[playerIdx];
  const updatedPlayers = state.players.map((p, idx) =>
    idx === playerIdx ? { ...p, hasPassedThisTrick: true } : p
  );

  const newLogs = [
    ...state.logs.slice(-18),
    `${player.name} memilih Lewat (Pass).`,
  ];

  const tableOwnerId = state.currentTablePlay.playerId;
  const tableOwner = updatedPlayers.find((p) => p.id === tableOwnerId);

  // Cek siapa lagi pemain aktif selain tableOwner yang belum Pass
  const otherActiveNotPassed = updatedPlayers.filter(
    (p) =>
      p.id !== tableOwnerId &&
      p.finishRank === null &&
      p.hand.length > 0 &&
      !p.hasPassedThisTrick
  );

  // Jika semua pemain lain sudah Pass, trick selesai dan meja bersih!
  if (otherActiveNotPassed.length === 0) {
    const resetPassPlayers = updatedPlayers.map((p) => ({
      ...p,
      hasPassedThisTrick: false,
    }));

    let nextLeaderId: string | null = null;
    if (tableOwner && tableOwner.finishRank === null && tableOwner.hand.length > 0) {
      nextLeaderId = tableOwner.id;
    } else {
      // Jika pemilik kartu tertinggi baru saja menghabiskan kartu terakhirnya,
      // giliran bebas diberikan ke pemain aktif berikutnya searah jarum jam
      nextLeaderId = findNextActivePlayerId(resetPassPlayers, tableOwnerId, true);
    }

    const leaderName =
      resetPassPlayers.find((p) => p.id === nextLeaderId)?.name || "Pemain";

    newLogs.push(
      `✨ Semua lawan lewat! Meja dikosongkan — ${leaderName} bebas mengeluarkan kombinasi baru.`
    );

    return {
      ...state,
      players: resetPassPlayers,
      currentTurnPlayerId: nextLeaderId,
      currentTablePlay: null,
      trickPile: [],
      logs: newLogs,
      updatedAt: Date.now(),
    };
  }

  // Masih ada pemain yang belum Pass, lanjutkan giliran ke pemain tersebut
  let nextTurnId = findNextActivePlayerId(updatedPlayers, playerId, false);
  if (!nextTurnId) {
    nextTurnId = tableOwnerId;
  }

  return {
    ...state,
    players: updatedPlayers,
    currentTurnPlayerId: nextTurnId,
    logs: newLogs,
    updatedAt: Date.now(),
  };
}

export const TAUNT_PRESETS: {
  id: string;
  emoji: string;
  text: string;
}[] = [
  { id: "laugh", emoji: "😂", text: "Hahaha mampus!" },
  { id: "trash", emoji: "😜", text: "Kartu ampas ya bos?" },
  { id: "fire", emoji: "🔥", text: "Senggol dong!" },
  { id: "bomb_warn", emoji: "💣", text: "Awas ada BOM siap meledak!" },
  { id: "ez", emoji: "😎", text: "Gampang banget (EZ)!" },
  { id: "slow", emoji: "⏳", text: "Lama amat mikirnya!" },
  { id: "cry", emoji: "😭", text: "Ampun suhu, jangan dibom!" },
  { id: "bait", emoji: "🃏", text: "Ayo keluarkan Pokermu!" },
];

/**
 * Mengirim Emot / Ejekan (Taunt) ke seluruh meja permainan (mendukung teks custom maupun preset).
 */
export function sendTaunt(
  state: GameState,
  playerId: string,
  tauntId: string,
  customText?: string,
  customEmoji?: string
): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  const trimmedCustom = customText ? customText.trim().slice(0, 60) : "";
  const preset =
    TAUNT_PRESETS.find((t) => t.id === tauntId) || TAUNT_PRESETS[0];

  const finalEmoji = trimmedCustom ? customEmoji || "😈" : preset.emoji;
  const finalText = trimmedCustom || preset.text;

  const tauntEvent = {
    id: `taunt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    senderId: player.id,
    senderName: player.name,
    tauntId: trimmedCustom ? "custom" : preset.id,
    emoji: finalEmoji,
    text: finalText,
    timestamp: Date.now(),
  };

  return {
    ...state,
    latestTaunt: tauntEvent,
    logs: [
      ...state.logs.slice(-18),
      `${finalEmoji} ${player.name}: "${finalText}"`,
    ],
    updatedAt: Date.now(),
  };
}

/**
 * Jika pemain memilih keluar saat permainan sedang berlangsung,
 * pemain tersebut otomatis dinyatakan KALAH (-10 poin) dan ronde berakhir.
 */
export function forfeitPlayer(state: GameState, playerId: string): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  if (state.phase === "waiting") {
    return removePlayerFromGame(state, playerId);
  }

  const numPlayers = state.players.length;

  // Urutkan pemain selain yang menyerah berdasarkan yang sudah selesai lebih dulu, lalu sisa kartu paling sedikit
  const otherPlayers = state.players
    .filter((p) => p.id !== playerId)
    .sort((a, b) => {
      if (a.finishRank !== null && b.finishRank !== null) {
        return a.finishRank - b.finishRank;
      }
      if (a.finishRank !== null) return -1;
      if (b.finishRank !== null) return 1;
      return a.hand.length - b.hand.length;
    });

  const rankMap = new Map<string, number>();
  otherPlayers.forEach((p, idx) => {
    rankMap.set(p.id, idx + 1);
  });
  rankMap.set(playerId, numPlayers);

  const updatedPlayers = state.players.map((p) => {
    const rank = rankMap.get(p.id) || numPlayers;
    const delta =
      p.id === playerId ? -10 : getNormalScoreByRank(numPlayers, rank);
    return {
      ...p,
      finishRank: rank,
      lastRoundDelta: delta,
      totalScore: p.totalScore + delta,
    };
  });

  const firstWinner = otherPlayers[0];
  const firstWinnerId = firstWinner ? firstWinner.id : null;
  const firstWinnerName = firstWinner ? firstWinner.name : "Pemain";

  const roundSummary: RoundSummary = {
    roundNumber: state.roundNumber,
    endReason: "normal",
    rankings: [...updatedPlayers]
      .sort((a, b) => (a.finishRank || 99) - (b.finishRank || 99))
      .map((p) => ({
        playerId: p.id,
        playerName: p.name,
        rank: p.finishRank,
        scoreDelta: p.lastRoundDelta,
        newTotalScore: p.totalScore,
        statusLabel:
          p.id === playerId
            ? "🏳️ Keluar / Kalah (-10)"
            : p.finishRank === 1
            ? "🥇 Juara 1"
            : `🏅 Juara ${p.finishRank}`,
      })),
    nextRoundMode: "collect_threes",
    nextStarterId: firstWinnerId,
    nextStarterName: firstWinnerName,
  };

  return {
    ...state,
    phase: "round_end",
    mustCollectThrees: true,
    previousWinnerId: null,
    players: updatedPlayers,
    currentTurnPlayerId: null,
    finishedOrder: [
      ...otherPlayers.map((p) => p.id),
      playerId,
    ],
    roundSummary,
    logs: [
      ...state.logs.slice(-18),
      `🏳️ ${player.name} keluar dari permainan dan dinyatakan KALAH (-10 pts)!`,
    ],
    updatedAt: Date.now(),
  };
}



