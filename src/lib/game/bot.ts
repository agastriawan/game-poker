import { passTurn, playCards, submitPlayerThrees } from "./engine";
import { findAllBombsInHand, findAllValidPlays } from "./rules";
import { GameState, PlayedCombo } from "./types";

/**
 * Memeriksa apakah ada Bot yang perlu melakukan aksi saat ini
 * (baik kumpul angka 3, memotong dengan BOM saat lawan buang 1 Poker, maupun jalan pada gilirannya).
 */
export function getNextBotAction(state: GameState): {
  botId: string;
  actionType: "submit_threes" | "bomb_intercept" | "play" | "pass";
  cardIds?: string[];
} | null {
  // 1. Fase Kumpul Angka 3: Cari bot yang belum mengumpulkan angka 3
  if (state.phase === "collecting_threes") {
    const pendingBot = state.players.find(
      (p) => p.isBot && !p.hasSubmittedThrees
    );
    if (pendingBot) {
      return {
        botId: pendingBot.id,
        actionType: "submit_threes",
      };
    }
    return null;
  }

  if (state.phase !== "playing") {
    return null;
  }

  // 2. Cek apakah di meja baru saja keluar Single Poker (2) dari pemain lain,
  // dan ada Bot yang memegang senjata BOM!
  if (
    state.currentTablePlay &&
    state.currentTablePlay.combo.type === "single" &&
    state.currentTablePlay.combo.primaryValue === 15
  ) {
    const pokerOwnerId = state.currentTablePlay.playerId;
    for (const p of state.players) {
      if (p.isBot && p.id !== pokerOwnerId && p.finishRank === null) {
        const bombs = findAllBombsInHand(p.hand);
        if (bombs.length > 0) {
          return {
            botId: p.id,
            actionType: "bomb_intercept",
            cardIds: bombs[0].cards.map((c) => c.id),
          };
        }
      }
    }
  }

  // 3. Cek apakah giliran saat ini adalah milik Bot
  const activePlayer = state.players.find(
    (p) => p.id === state.currentTurnPlayerId
  );
  if (!activePlayer || !activePlayer.isBot || activePlayer.finishRank !== null) {
    return null;
  }

  const currentTableCombo = state.currentTablePlay
    ? state.currentTablePlay.combo
    : null;

  const validPlays = findAllValidPlays(activePlayer.hand, currentTableCombo);

  if (validPlays.length === 0) {
    return {
      botId: activePlayer.id,
      actionType: "pass",
    };
  }

  // Pilih langkah terbaik untuk Bot
  const chosenPlay = chooseBestBotPlay(
    validPlays,
    activePlayer.hand.length,
    currentTableCombo === null
  );

  if (!chosenPlay) {
    return {
      botId: activePlayer.id,
      actionType: "pass",
    };
  }

  return {
    botId: activePlayer.id,
    actionType: "play",
    cardIds: chosenPlay.cards.map((c) => c.id),
  };
}

/**
 * Heuristik cerdas pemilihan kartu Bot:
 * - Saat meja kosong (bebas jalan): Prioritaskan membuang kombinasi banyak kartu (Full House, Seri Sejenis, Triple, Double) dengan angka rendah terlebih dahulu.
 * - Hindari membuang kartu Poker (2) jika masih banyak kartu kecil, kecuali tinggal sedikit kartu.
 */
function chooseBestBotPlay(
  validPlays: PlayedCombo[],
  handSize: number,
  isFreeLead: boolean
): PlayedCombo | null {
  if (validPlays.length === 0) return null;

  // Jika ada langkah yang langsung menghabiskan seluruh kartu di tangan, langsung ambil!
  const instantWin = validPlays.find((p) => p.length === handSize);
  if (instantWin) return instantWin;

  // Karena Poker (2) tidak boleh ditaruh di paling akhir, jika sisa kartu tinggal sedikit (<= 4),
  // prioritaskan membuang kartu Poker (2) terlebih dahulu agar tidak nyangkut di akhir!
  if (handSize <= 4) {
    const pokerPlay = validPlays.find((p) =>
      p.cards.some((c) => c.value === 15)
    );
    if (pokerPlay) return pokerPlay;
  }

  if (isFreeLead) {
    // Urutkan prioritas saat jalan bebas: kombinasi kartu lebih banyak & nilai rendah didahulukan
    // tetapi jangan pecahkan 5-card straight flush jika masih banyak kartu (simpan buat Bom!)
    const nonBombPlays = validPlays.filter(
      (p) =>
        p.type !== "four_of_a_kind" &&
        !(p.type === "straight_flush" && p.length === 5 && handSize > 6)
    );
    const pool = nonBombPlays.length > 0 ? nonBombPlays : validPlays;

    const sorted = [...pool].sort((a, b) => {
      // Utamakan membuang kombinasi multi-kartu (kecuali bernilai Poker/A)
      if (a.primaryValue <= 13 && b.primaryValue <= 13 && a.length !== b.length) {
        return b.length - a.length;
      }
      return a.primaryValue - b.primaryValue;
    });

    return sorted[0];
  } else {
    // Melawan kartu di meja: pilih yang nilainya paling kecil yang cukup untuk mengalahkan lawan
    const sorted = [...validPlays].sort(
      (a, b) => a.primaryValue - b.primaryValue
    );
    return sorted[0];
  }
}

/**
 * Menjalankan satu langkah Bot pada state permainan.
 */
export function executeBotStep(state: GameState): GameState {
  const action = getNextBotAction(state);
  if (!action) return state;

  if (action.actionType === "submit_threes") {
    return submitPlayerThrees(state, action.botId);
  }
  if (
    (action.actionType === "bomb_intercept" || action.actionType === "play") &&
    action.cardIds
  ) {
    return playCards(state, action.botId, action.cardIds);
  }
  if (action.actionType === "pass") {
    return passTurn(state, action.botId);
  }
  return state;
}

