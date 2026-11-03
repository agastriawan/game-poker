import { passTurn, playCards, submitPlayerThrees } from "./engine";
import { findAllBombsInHand, findAllValidPlays } from "./rules";
import { Card, GameState, PlayedCombo, PlayerState } from "./types";

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

  const difficulty = state.botDifficulty || "medium";

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
          // Pada mode Easy (Santai), bot punya peluang 30% untuk tidak memotong (kasual)
          if (difficulty === "easy" && Math.random() < 0.3) {
            continue;
          }
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

  // Pilih langkah terbaik untuk Bot berdasarkan tingkat kesulitan & analisa situasi meja
  const chosenPlay = chooseBestBotPlay(
    validPlays,
    activePlayer,
    state,
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
 * Analisis sinergi kartu tangan bot:
 * Mengidentifikasi kartu kombo (Pair, Triple, Flush, Bomb) vs kartu lepas/sampah (Loose Singles).
 */
interface HandSynergy {
  looseCardIds: Set<string>;
  pairValues: Set<number>;
  tripleValues: Set<number>;
  bombCardIds: Set<string>;
  hasMultiCardCombos: boolean;
}

function analyzeHandSynergy(hand: Card[]): HandSynergy {
  const valueCounts = new Map<number, Card[]>();
  for (const c of hand) {
    const list = valueCounts.get(c.value) || [];
    list.push(c);
    valueCounts.set(c.value, list);
  }

  const pairValues = new Set<number>();
  const tripleValues = new Set<number>();
  const comboCardIds = new Set<string>();

  for (const [val, cards] of valueCounts.entries()) {
    if (cards.length === 2) {
      pairValues.add(val);
      cards.forEach((c) => comboCardIds.add(c.id));
    } else if (cards.length === 3) {
      tripleValues.add(val);
      cards.forEach((c) => comboCardIds.add(c.id));
    } else if (cards.length >= 4) {
      cards.forEach((c) => comboCardIds.add(c.id));
    }
  }

  // Deteksi seri sejenis (straight flush panjang >= 3)
  const bySuit = new Map<string, Card[]>();
  for (const c of hand) {
    if (c.value === 15) continue; // Poker 2 dikecualikan dari seri reguler
    const list = bySuit.get(c.suit) || [];
    list.push(c);
    bySuit.set(c.suit, list);
  }

  for (const [, suitCards] of bySuit.entries()) {
    const sorted = [...suitCards].sort((a, b) => a.value - b.value);
    let seq: Card[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (seq.length === 0 || sorted[i].value === seq[seq.length - 1].value + 1) {
        seq.push(sorted[i]);
      } else {
        if (seq.length >= 3) {
          seq.forEach((c) => comboCardIds.add(c.id));
        }
        seq = [sorted[i]];
      }
    }
    if (seq.length >= 3) {
      seq.forEach((c) => comboCardIds.add(c.id));
    }
  }

  // Deteksi Bom
  const bombs = findAllBombsInHand(hand);
  const bombCardIds = new Set<string>();
  for (const b of bombs) {
    b.cards.forEach((c) => bombCardIds.add(c.id));
  }

  // Kartu sampah adalah kartu yang tidak tergabung dalam kombo apapun
  const looseCardIds = new Set<string>();
  for (const c of hand) {
    if (!comboCardIds.has(c.id) && !bombCardIds.has(c.id)) {
      looseCardIds.add(c.id);
    }
  }

  const hasMultiCardCombos =
    pairValues.size > 0 || tripleValues.size > 0 || bombs.length > 0;

  return {
    looseCardIds,
    pairValues,
    tripleValues,
    bombCardIds,
    hasMultiCardCombos,
  };
}

/**
 * Mengumpulkan konteks ancaman lawan di meja (jumlah kartu sisa pemain lain).
 */
interface OpponentContext {
  anyOpponentHasOneCard: boolean;
  anyOpponentHasTwoCards: boolean;
  isNextPlayerAtOneCard: boolean;
  isNextPlayerAtTwoCards: boolean;
  minOpponentHandSize: number;
}

function getOpponentContext(
  activePlayerId: string,
  state: GameState
): OpponentContext {
  const opponents = state.players.filter(
    (p) => p.id !== activePlayerId && p.finishRank === null
  );

  const anyOpponentHasOneCard = opponents.some((p) => p.hand.length === 1);
  const anyOpponentHasTwoCards = opponents.some((p) => p.hand.length === 2);
  const minOpponentHandSize =
    opponents.length > 0 ? Math.min(...opponents.map((p) => p.hand.length)) : 13;

  const activeIndex = state.players.findIndex((p) => p.id === activePlayerId);
  let nextPlayer: PlayerState | null = null;
  if (activeIndex !== -1) {
    for (let i = 1; i < state.players.length; i++) {
      const idx = (activeIndex + i) % state.players.length;
      const candidate = state.players[idx];
      if (candidate.finishRank === null) {
        nextPlayer = candidate;
        break;
      }
    }
  }

  return {
    anyOpponentHasOneCard,
    anyOpponentHasTwoCards,
    isNextPlayerAtOneCard: nextPlayer?.hand.length === 1,
    isNextPlayerAtTwoCards: nextPlayer?.hand.length === 2,
    minOpponentHandSize,
  };
}

/**
 * Pemilihan kartu terbaik Bot dengan mempertimbangkan tingkat kesulitan:
 * - Easy: Heuristik sederhana & kasual.
 * - Medium: Manajemen kombo, anti-kebobolan 1 kartu lawan, dan penyelamatan kartu 2.
 * - Hard: Taktik Pro (Tactical Pass, penjagaan ketat pemain sebelah, dan kepribadian karakter).
 */
export function chooseBestBotPlay(
  validPlays: PlayedCombo[],
  activePlayer: PlayerState,
  state: GameState,
  isFreeLead: boolean
): PlayedCombo | null {
  if (validPlays.length === 0) return null;

  const handSize = activePlayer.hand.length;

  // 1. Jika ada langkah yang langsung memenangkan ronde (menghabiskan seluruh kartu), ambil sekarang!
  const instantWin = validPlays.find((p) => p.length === handSize);
  if (instantWin) return instantWin;

  const difficulty = state.botDifficulty || "medium";

  // 2. Safeguard Kartu Poker (2):
  // Sesuai aturan: Kartu Poker (2) tidak boleh jadi kartu terakhir!
  // Jika sisa kartu tinggal sedikit (<= 4) dan kita memegang 2, prioritaskan membuang 2 lebih awal
  if (difficulty !== "easy" && handSize <= 4 && handSize > 1) {
    const pokerPlay = validPlays.find(
      (p) =>
        p.cards.some((c) => c.value === 15) &&
        p.length < handSize // Pastikan bukan kartu terakhir
    );
    if (pokerPlay) return pokerPlay;
  }

  if (difficulty === "easy") {
    return chooseEasyPlay(validPlays, handSize, isFreeLead);
  }

  if (difficulty === "hard") {
    return chooseHardPlay(validPlays, activePlayer, state, isFreeLead);
  }

  // Default: Medium / Taktis
  return chooseMediumPlay(validPlays, activePlayer, state, isFreeLead);
}

/**
 * Logika Bot Level: SANTAI (EASY)
 * Bermain kasual, membuang kartu terendah tanpa analisa mendalam.
 */
function chooseEasyPlay(
  validPlays: PlayedCombo[],
  handSize: number,
  isFreeLead: boolean
): PlayedCombo | null {
  if (isFreeLead) {
    // Pada jalan bebas: urutkan kombinasi terbanyak & terkecil
    const nonBomb = validPlays.filter((p) => p.type !== "four_of_a_kind");
    const pool = nonBomb.length > 0 ? nonBomb : validPlays;

    const sorted = [...pool].sort((a, b) => {
      if (a.primaryValue <= 13 && b.primaryValue <= 13 && a.length !== b.length) {
        return b.length - a.length;
      }
      return a.primaryValue - b.primaryValue;
    });
    return sorted[0];
  } else {
    // Melawan meja: ambil yang nilainya paling kecil
    const sorted = [...validPlays].sort(
      (a, b) => a.primaryValue - b.primaryValue
    );
    return sorted[0];
  }
}

/**
 * Logika Bot Level: MENENGAH (MEDIUM)
 * Menjaga kombo berharga (tidak sembarangan memecah Pair/Triple),
 * membuang kartu sampah, dan anti-kebobolan jika lawan sisa 1 kartu.
 */
function chooseMediumPlay(
  validPlays: PlayedCombo[],
  activePlayer: PlayerState,
  state: GameState,
  isFreeLead: boolean
): PlayedCombo | null {
  const synergy = analyzeHandSynergy(activePlayer.hand);
  const oppCtx = getOpponentContext(activePlayer.id, state);
  const handSize = activePlayer.hand.length;

  if (isFreeLead) {
    // A. ANTI-KEBOBOLAN (Jika ada lawan yang tinggal 1 kartu di tangan):
    if (oppCtx.anyOpponentHasOneCard) {
      // 1. Usahakan melempar kombo multi-kartu (Double, Triple, Full House, Seri)
      // karena pemain yang punya 1 kartu TIDAK AKAN PERNAH BISA MEMBALAS kombo!
      const multiCardPlays = validPlays.filter(
        (p) =>
          p.length >= 2 &&
          p.type !== "four_of_a_kind" // Simpan Bom jika ada alternatif
      );
      if (multiCardPlays.length > 0) {
        // Urutkan multi-kartu dari yang paling bernilai rendah
        multiCardPlays.sort((a, b) => {
          if (a.length !== b.length) return b.length - a.length;
          return a.primaryValue - b.primaryValue;
        });
        return multiCardPlays[0];
      }

      // 2. Jika terpaksa harus buang kartu single (hanya punya single di tangan):
      // DILARANG membuang single kecil! Buang single TERTINGGI (As / Poker 2) agar lawan tidak menang gratis!
      const singlePlays = validPlays.filter((p) => p.type === "single");
      if (singlePlays.length > 0) {
        singlePlays.sort((a, b) => b.primaryValue - a.primaryValue); // Urutan tertinggi dulu
        return singlePlays[0];
      }
    }

    // B. Situasi Normal (Tidak ada lawan yang sisa 1 kartu):
    // Prioritaskan membuang kartu sampah (loose single) rendah atau kombo rendah
    const nonBombs = validPlays.filter(
      (p) =>
        p.type !== "four_of_a_kind" &&
        !(p.type === "straight_flush" && p.length === 5 && handSize > 6)
    );
    const pool = nonBombs.length > 0 ? nonBombs : validPlays;

    // Filter yang tidak membuang Single 2 (Poker) di awal ronde
    const safePool =
      handSize > 4
        ? pool.filter((p) => !(p.type === "single" && p.primaryValue === 15))
        : pool;
    const finalPool = safePool.length > 0 ? safePool : pool;

    const sorted = [...finalPool].sort((a, b) => {
      // Kombo multi-kartu nilai rendah didahulukan
      if (a.length >= 2 && b.length >= 2) {
        if (a.length !== b.length) return b.length - a.length;
        return a.primaryValue - b.primaryValue;
      }
      if (a.length >= 2) return -1;
      if (b.length >= 2) return 1;

      // Pada single: utamakan loose single (kartu sampah)
      const aIsLoose = a.cards.every((c) => synergy.looseCardIds.has(c.id));
      const bIsLoose = b.cards.every((c) => synergy.looseCardIds.has(c.id));
      if (aIsLoose && !bIsLoose) return -1;
      if (!aIsLoose && bIsLoose) return 1;

      return a.primaryValue - b.primaryValue;
    });

    return sorted[0];
  } else {
    // MELAWAN KARTU DI MEJA:
    // 1. Jika meja berisi single: Utamakan melawan dengan kartu sampah (loose single)
    // agar tidak memecah Pair atau Triple yang berharga
    if (state.currentTablePlay?.combo.type === "single") {
      const loosePlays = validPlays.filter((p) =>
        p.cards.every((c) => synergy.looseCardIds.has(c.id))
      );
      if (loosePlays.length > 0) {
        loosePlays.sort((a, b) => a.primaryValue - b.primaryValue);
        return loosePlays[0];
      }
    }

    // 2. Ambil kartu valid terendah
    const sorted = [...validPlays].sort(
      (a, b) => a.primaryValue - b.primaryValue
    );
    return sorted[0];
  }
}

/**
 * Logika Bot Level: SULIT / PRO (HARD)
 * Dilengkapi Tactical Pass (menahan kartu sakti jika tidak punya follow-up),
 * penjagaan ekstra ketat pada pemain setelahnya, dan kepribadian karakter.
 */
function chooseHardPlay(
  validPlays: PlayedCombo[],
  activePlayer: PlayerState,
  state: GameState,
  isFreeLead: boolean
): PlayedCombo | null {
  const synergy = analyzeHandSynergy(activePlayer.hand);
  const oppCtx = getOpponentContext(activePlayer.id, state);
  const handSize = activePlayer.hand.length;
  const botName = activePlayer.name;

  if (isFreeLead) {
    // 1. KEPRIBADIAN BOT SAAT JALAN BEBAS:
    // - Bot Himiya: Agresif, suka langsung membuka dengan kombo terpanjang
    if (botName.includes("Himiya")) {
      const longestCombos = [...validPlays].filter(
        (p) => p.type !== "four_of_a_kind"
      );
      if (longestCombos.length > 0) {
        longestCombos.sort((a, b) => {
          if (a.length !== b.length) return b.length - a.length;
          return a.primaryValue - b.primaryValue;
        });
        if (longestCombos[0].length >= 3) {
          return longestCombos[0];
        }
      }
    }

    // 2. PENJAGAAN KETAT ANTI-KEBOBOLAN
    if (oppCtx.anyOpponentHasOneCard || oppCtx.isNextPlayerAtOneCard) {
      const multiCardPlays = validPlays.filter(
        (p) => p.length >= 2 && p.type !== "four_of_a_kind"
      );
      if (multiCardPlays.length > 0) {
        multiCardPlays.sort((a, b) => {
          if (a.length !== b.length) return b.length - a.length;
          return a.primaryValue - b.primaryValue;
        });
        return multiCardPlays[0];
      }

      // Terpaksa buang single: wajib keluarkan kartu tertinggi
      const singlePlays = validPlays.filter((p) => p.type === "single");
      if (singlePlays.length > 0) {
        singlePlays.sort((a, b) => b.primaryValue - a.primaryValue);
        return singlePlays[0];
      }
    }

    // 3. Normal Lead pada Hard: prioritaskan loose singles atau kombo rendah
    return chooseMediumPlay(validPlays, activePlayer, state, isFreeLead);
  } else {
    // =========================================================================
    // MELAWAN KARTU DI MEJA (DENGAN TACTICAL PASS):
    // =========================================================================
    const tablePlay = state.currentTablePlay;
    if (!tablePlay) return validPlays[0];

    // 1. BLOKIR PEMAIN BERIKUTNYA YANG SISA 1 KARTU:
    // Jika pemain setelah kita memegang 1 kartu dan meja bernilai kecil/sedang,
    // kita WAJIB memotong dengan kartu tinggi agar trik tidak jatuh ke dia
    if (oppCtx.isNextPlayerAtOneCard && tablePlay.combo.type === "single") {
      const highStoppers = validPlays.filter((p) => p.primaryValue >= 13); // K, A, atau 2
      if (highStoppers.length > 0) {
        highStoppers.sort((a, b) => a.primaryValue - b.primaryValue);
        return highStoppers[0]; // Pakai stopper terendah yang cukup kuat
      }
    }

    // 2. TACTICAL PASS (Menahan kartu sakti As atau 2):
    // Jika meja berisi single sedang (misal 7, 8, 9, 10), dan kartu satu-satunya yang bisa melawan
    // hanyalah As (14) atau Poker (15), sementara bot masih punya banyak kartu (>= 5)
    // dan tidak punya kombo penutup yang kuat:
    // -> Bot Pro MEMILIH PASS daripada membuang 2 secara sia-sia!
    if (
      tablePlay.combo.type === "single" &&
      tablePlay.combo.primaryValue <= 11 && // Meja kartu J atau lebih kecil
      handSize >= 5 &&
      !oppCtx.anyOpponentHasOneCard // Tidak sedang darurat lawan 1 kartu
    ) {
      // Cek apakah semua opsi valid bot bernilai >= 14 (As atau Poker 2)
      const lowestOption = Math.min(...validPlays.map((p) => p.primaryValue));
      if (lowestOption >= 14) {
        // Pada Bot Riko (Oportunis), kecenderungan menahan kartu semakin tinggi
        // Pass secara taktis untuk menyimpan kartu sakti
        return null;
      }
    }

    // 3. Jaga keutuhan kombo: Hindari memecah pair/triple untuk melawan single
    if (tablePlay.combo.type === "single") {
      const loosePlays = validPlays.filter((p) =>
        p.cards.every((c) => synergy.looseCardIds.has(c.id))
      );
      if (loosePlays.length > 0) {
        loosePlays.sort((a, b) => a.primaryValue - b.primaryValue);
        return loosePlays[0];
      }
    }

    // 4. Standar balasan: ambil yang terendah
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
