import { SUIT_NAMES_ID, SUIT_SYMBOLS, sortHand } from "./shuffle";
import { Card, PlayedCombo, RankValue } from "./types";

/**
 * Mengevaluasi apakah kumpulan kartu yang dipilih pemain membentuk kombinasi yang sah.
 * Mengembalikan objek PlayedCombo jika sah, atau null jika tidak sah.
 */
export function evaluateCombo(selectedCards: Card[]): PlayedCombo | null {
  if (!selectedCards || selectedCards.length === 0) return null;

  const cards = sortHand(selectedCards);
  const len = cards.length;

  // 1. SINGLE (1 Kartu)
  if (len === 1) {
    const c = cards[0];
    const pokerTag = c.value === 15 ? " (Poker)" : "";
    return {
      type: "single",
      cards,
      primaryValue: c.value,
      length: 1,
      label: `Single ${c.rank}${SUIT_SYMBOLS[c.suit]}${pokerTag}`,
    };
  }

  // 2. DOUBLE (2 Kartu Kembar)
  if (len === 2) {
    if (cards[0].value === cards[1].value) {
      const pokerTag = cards[0].value === 15 ? " Poker" : "";
      return {
        type: "double",
        cards,
        primaryValue: cards[0].value,
        length: 2,
        label: `Double ${cards[0].rank}${pokerTag}`,
      };
    }
    return null;
  }

  // 3. TRIPLE (3 Kartu Kembar)
  if (len === 3 && cards[0].value === cards[1].value && cards[1].value === cards[2].value) {
    const pokerTag = cards[0].value === 15 ? " Poker" : "";
    return {
      type: "triple",
      cards,
      primaryValue: cards[0].value,
      length: 3,
      label: `Triple ${cards[0].rank}${pokerTag}`,
    };
  }

  // 4. FOUR OF A KIND / BOM 4 KEMBAR (4 Kartu Kembar Lengkap 4 Bentuk)
  if (
    len === 4 &&
    cards[0].value === cards[1].value &&
    cards[1].value === cards[2].value &&
    cards[2].value === cards[3].value
  ) {
    return {
      type: "four_of_a_kind",
      cards,
      primaryValue: cards[0].value,
      length: 4,
      label: `BOM 4 Kartu ${cards[0].rank} Lengkap!`,
    };
  }

  // 5. FULL HOUSE (5 Kartu)
  // Bisa berupa:
  // a) Full House Klasik: 3 Kartu Kembar + 2 Kartu Kembar Buntut (misal 4-4-4 + 3-3)
  // b) Full House Seri Sejenis: 3 Kartu Seri Sejenis (Straight Flush) + 2 Kartu Kembar Buntut (misal 9♦-10♦-J♦ + 5♥-5♠)
  if (len === 5) {
    // Bentuk A: Full House Klasik (3 kembar + 2 kembar)
    const counts = new Map<RankValue, Card[]>();
    for (const c of cards) {
      const list = counts.get(c.value) || [];
      list.push(c);
      counts.set(c.value, list);
    }

    if (counts.size === 2) {
      let tripletRank: RankValue | null = null;
      let pairRank: RankValue | null = null;
      let tripletLabel = "";
      let pairLabel = "";

      for (const [val, group] of counts.entries()) {
        if (group.length === 3) {
          tripletRank = val;
          tripletLabel = group[0].rank;
        } else if (group.length === 2) {
          pairRank = val;
          pairLabel = group[0].rank;
        }
      }

      if (tripletRank !== null && pairRank !== null) {
        // Urutkan agar 3 kartu utama di depan dan 2 kartu buntut di belakang
        const orderedCards = [
          ...(counts.get(tripletRank) || []),
          ...(counts.get(pairRank) || []),
        ];
        return {
          type: "full_house",
          cards: orderedCards,
          primaryValue: tripletRank,
          length: 5,
          label: `Full House ${tripletLabel} (Buntut ${pairLabel})`,
        };
      }
    }

    // Bentuk B: Full House Seri Sejenis + 2 Buntut (3 Seri Sejenis + 2 Kembar)
    // Contoh: 9♦-10♦-J♦ + 5♥-5♠
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        if (cards[i].value === cards[j].value) {
          const pairCards = [cards[i], cards[j]];
          const remaining3 = cards.filter((_, idx) => idx !== i && idx !== j);

          const sorted3 = sortHand(remaining3);
          const firstSuit = sorted3[0].suit;
          const allSameSuit = sorted3.every((c) => c.suit === firstSuit);
          const hasPokerTwo = sorted3.some((c) => c.value === 15);

          if (allSameSuit && !hasPokerTwo) {
            const isConsecutive =
              sorted3[1].value === sorted3[0].value + 1 &&
              sorted3[2].value === sorted3[1].value + 1;

            if (isConsecutive) {
              const rankSeq = sorted3.map((c) => c.rank).join("-");
              const suitSym = SUIT_SYMBOLS[firstSuit];
              const pairRankLabel = pairCards[0].rank;
              const orderedCards = [...sorted3, ...pairCards];

              return {
                type: "straight_flush_pair",
                cards: orderedCards,
                primaryValue: sorted3[2].value, // Kartu tertinggi dalam seri 3 kartu tersebut
                length: 5,
                label: `Seri ${rankSeq}${suitSym} (Buntut ${pairRankLabel})`,
              };
            }
          }
        }
      }
    }
  }

  // 6. SERI SEJENIS / STRAIGHT FLUSH (Minimal 3 Kartu, Lambang Sama, Berurutan, Tanpa Kartu 2/Poker)
  if (len >= 3) {
    const firstSuit = cards[0].suit;
    const allSameSuit = cards.every((c) => c.suit === firstSuit);
    // Kartu 2 (Poker, value 15) adalah kartu tertinggi berdiri sendiri dan tidak masuk urutan seri
    const hasPokerTwo = cards.some((c) => c.value === 15);

    if (allSameSuit && !hasPokerTwo) {
      let isConsecutive = true;
      for (let i = 1; i < cards.length; i++) {
        if (cards[i].value !== cards[i - 1].value + 1) {
          isConsecutive = false;
          break;
        }
      }

      if (isConsecutive) {
        const rankSeq = cards.map((c) => c.rank).join("-");
        const suitName = SUIT_NAMES_ID[firstSuit];
        const suitSym = SUIT_SYMBOLS[firstSuit];
        return {
          type: "straight_flush",
          cards,
          primaryValue: cards[cards.length - 1].value,
          length: len,
          label: `Seri ${rankSeq} ${suitName} ${suitSym}`,
        };
      }
    }
  }

  return null;
}

/**
 * Memeriksa apakah kombinasi adalah senjata BOM yang sah terhadap kombinasi di meja.
 * Aturan Bom:
 * - Kartu di meja HARUS Single Poker (1 kartu angka 2, value = 15).
 *   (Double / Triple Poker TIDAK BISA di-bom).
 * - Kartu pengebom harus berupa:
 *   a) 4 Kartu Kembar Lengkap (four_of_a_kind), ATAU
 *   b) 5 Kartu Seri Sejenis (straight_flush dengan length === 5).
 */
export function isBombAgainstSinglePoker(
  candidate: PlayedCombo,
  currentTable: PlayedCombo | null
): boolean {
  if (!currentTable) return false;

  const isTableSinglePoker =
    currentTable.type === "single" && currentTable.primaryValue === 15;
  if (!isTableSinglePoker) return false;

  const isQuadBomb = candidate.type === "four_of_a_kind" && candidate.length === 4;
  const isFiveCardStraightFlushBomb =
    candidate.type === "straight_flush" && candidate.length === 5;

  return isQuadBomb || isFiveCardStraightFlushBomb;
}

/**
 * Memvalidasi apakah kombinasi kartu kandidat (`candidate`) boleh dimainkan
 * melawan kartu di meja (`currentTable`).
 */
export function canBeatPlay(
  candidate: PlayedCombo,
  currentTable: PlayedCombo | null
): {
  valid: boolean;
  isBomb: boolean;
  reason?: string;
} {
  // Jika meja kosong (giliran bebas / pemegang kendali jalan)
  if (!currentTable) {
    return { valid: true, isBomb: false };
  }

  // Cek apakah ini langkah BOM terhadap 1 kartu Poker (Single 2)
  if (isBombAgainstSinglePoker(candidate, currentTable)) {
    return { valid: true, isBomb: true };
  }

  // Jika lawan mengeluarkan Single Poker (2) dan kandidat bukan Bom
  if (currentTable.type === "single" && currentTable.primaryValue === 15) {
    return {
      valid: false,
      isBomb: false,
      reason:
        "Kartu 1 Poker (2) adalah kartu tertinggi! Hanya bisa dilawan dengan BOM (4 Kartu Kembar atau 5 Kartu Seri Sejenis).",
    };
  }

  // Jika lawan mengeluarkan Double/Triple Poker (2) -> tidak bisa dilawan & tidak bisa di-bom
  if (
    (currentTable.type === "double" || currentTable.type === "triple") &&
    currentTable.primaryValue === 15
  ) {
    return {
      valid: false,
      isBomb: false,
      reason: `${currentTable.label} adalah kombinasi tertinggi dan tidak bisa di-bom!`,
    };
  }

  // Untuk langkah normal: Tipe dan jumlah kartu harus sama persis
  if (candidate.type !== currentTable.type || candidate.length !== currentTable.length) {
    return {
      valid: false,
      isBomb: false,
      reason: `Harus mengeluarkan kombinasi sejenis (${currentTable.label}) dengan angka yang lebih tinggi!`,
    };
  }

  // Nilai angka harus lebih tinggi (lambang tidak membedakan kuat/lemah)
  if (candidate.primaryValue <= currentTable.primaryValue) {
    return {
      valid: false,
      isBomb: false,
      reason: `Angka kartu harus lebih tinggi dari ${currentTable.label}!`,
    };
  }

  return { valid: true, isBomb: false };
}

/**
 * Mencari semua kombinasi BOM (4 Kembar atau 5 Kartu Seri Sejenis) yang dimiliki di tangan pemain.
 * Digunakan untuk menyalakan tombol interaktif "🔥 BOM POKER!" ketika lawan mengeluarkan Single 2.
 */
export function findAllBombsInHand(hand: Card[]): PlayedCombo[] {
  const bombs: PlayedCombo[] = [];
  const sorted = sortHand(hand);

  // 1. Cari 4 Kartu Kembar (Four of a Kind)
  const byValue = new Map<RankValue, Card[]>();
  for (const c of sorted) {
    const arr = byValue.get(c.value) || [];
    arr.push(c);
    byValue.set(c.value, arr);
  }

  for (const [, group] of byValue.entries()) {
    if (group.length === 4) {
      const combo = evaluateCombo(group);
      if (combo) {
        bombs.push({ ...combo, isBombMove: true });
      }
    }
  }

  // 2. Cari 5 Kartu Seri Sejenis (5-Card Straight Flush, tanpa kartu 2)
  const bySuit = new Map<string, Card[]>();
  for (const c of sorted) {
    if (c.value === 15) continue;
    const arr = bySuit.get(c.suit) || [];
    arr.push(c);
    bySuit.set(c.suit, arr);
  }

  for (const [, suitCards] of bySuit.entries()) {
    if (suitCards.length < 5) continue;
    for (let i = 0; i <= suitCards.length - 5; i++) {
      const slice = suitCards.slice(i, i + 5);
      const combo = evaluateCombo(slice);
      if (combo && combo.type === "straight_flush" && combo.length === 5) {
        bombs.push({
          ...combo,
          isBombMove: true,
          label: `BOM ${combo.label}!`,
        });
      }
    }
  }

  return bombs;
}

/**
 * Memeriksa apakah langkah kandidat melanggar aturan:
 * "Kartu Poker (2) TIDAK BOLEH ditaruh di paling akhir!"
 * - Tidak boleh menghabiskan kartu di tangan (sisa 0 kartu) menggunakan kombinasi yang mengandung Poker (2).
 * - Tidak boleh membuang kartu yang menyebabkan sisa kartu di tangan HANYA menyisakan kartu Poker (2),
 *   karena itu otomatis memaksa kartu Poker menjadi kartu paling akhir.
 */
export function checkPokerLastCardViolation(
  hand: Card[],
  candidateCards: Card[]
): {
  violates: boolean;
  reason?: string;
} {
  const selectedIds = new Set(candidateCards.map((c) => c.id));
  const remainingHand = hand.filter((c) => !selectedIds.has(c.id));
  const candidateHasPoker = candidateCards.some((c) => c.value === 15);

  if (remainingHand.length === 0 && candidateHasPoker) {
    return {
      violates: true,
      reason:
        "Kartu Poker (2) tidak boleh ditaruh di paling akhir untuk menutup permainan!",
    };
  }

  if (
    remainingHand.length > 0 &&
    remainingHand.every((c) => c.value === 15)
  ) {
    return {
      violates: true,
      reason:
        "Tidak boleh menyisakan kartu Poker (2) di paling akhir! Keluarkan kartu Poker terlebih dahulu.",
    };
  }

  return { violates: false };
}

/**
 * Mencari seluruh langkah yang valid dari tangan pemain terhadap `currentTable`.
 * Berguna untuk fitur "Hint / Saran Kartu" dan kecerdasan Bot AI.
 */
export function findAllValidPlays(
  hand: Card[],
  currentTable: PlayedCombo | null
): PlayedCombo[] {
  const sorted = sortHand(hand);
  const validPlays: PlayedCombo[] = [];

  // Jika meja sedang berisi Single Poker (2), hanya BOM yang valid
  if (currentTable && currentTable.type === "single" && currentTable.primaryValue === 15) {
    return findAllBombsInHand(sorted);
  }

  const pushIfLegal = (combo: PlayedCombo | null) => {
    if (!combo) return;
    const beat = canBeatPlay(combo, currentTable);
    if (!beat.valid) return;
    if (!beat.isBomb && checkPokerLastCardViolation(sorted, combo.cards).violates) {
      return;
    }
    validPlays.push(combo);
  };

  // Grup berdasarkan nilai angka
  const byValue = new Map<RankValue, Card[]>();
  for (const c of sorted) {
    const arr = byValue.get(c.value) || [];
    arr.push(c);
    byValue.set(c.value, arr);
  }

  // 1. Semua Single
  if (!currentTable || currentTable.type === "single") {
    for (const c of sorted) {
      pushIfLegal(evaluateCombo([c]));
    }
  }

  // 2. Semua Double
  if (!currentTable || currentTable.type === "double") {
    for (const [, group] of byValue.entries()) {
      if (group.length >= 2) {
        pushIfLegal(evaluateCombo(group.slice(0, 2)));
      }
    }
  }

  // 3. Semua Triple
  if (!currentTable || currentTable.type === "triple") {
    for (const [, group] of byValue.entries()) {
      if (group.length >= 3) {
        pushIfLegal(evaluateCombo(group.slice(0, 3)));
      }
    }
  }

  // 4. Semua Seri Sejenis (Straight Flush panjang 3 s/d 8)
  if (!currentTable || currentTable.type === "straight_flush") {
    const bySuit = new Map<string, Card[]>();
    for (const c of sorted) {
      if (c.value === 15) continue;
      const arr = bySuit.get(c.suit) || [];
      arr.push(c);
      bySuit.set(c.suit, arr);
    }

    const minLen = currentTable ? currentTable.length : 3;
    const maxLen = currentTable ? currentTable.length : 8;

    for (const [, suitCards] of bySuit.entries()) {
      for (let len = minLen; len <= maxLen; len++) {
        if (suitCards.length < len) continue;
        for (let i = 0; i <= suitCards.length - len; i++) {
          const slice = suitCards.slice(i, i + len);
          pushIfLegal(evaluateCombo(slice));
        }
      }
    }
  }

  // 5. Semua Full House Klasik (3 Kembar + 2 Buntut)
  if (!currentTable || currentTable.type === "full_house") {
    const triplets: Card[][] = [];
    const pairs: Card[][] = [];

    for (const [, group] of byValue.entries()) {
      if (group.length >= 3) {
        triplets.push(group.slice(0, 3));
      }
      if (group.length >= 2) {
        pairs.push(group.slice(0, 2));
      }
    }

    for (const t of triplets) {
      for (const p of pairs) {
        if (t[0].value === p[0].value) continue;
        pushIfLegal(evaluateCombo([...t, ...p]));
      }
    }
  }

  // 6. Semua Seri Sejenis + 2 Buntut (3 Seri Sejenis + 2 Buntut)
  // Catatan: Kategori ini terpisah dari Full House (Triple). Seri hanya bisa dilawan Seri.
  if (!currentTable || currentTable.type === "straight_flush_pair") {
    const pairs: Card[][] = [];
    for (const [, group] of byValue.entries()) {
      if (group.length >= 2) {
        pairs.push(group.slice(0, 2));
      }
    }

    const bySuit = new Map<string, Card[]>();
    for (const c of sorted) {
      if (c.value === 15) continue;
      const arr = bySuit.get(c.suit) || [];
      arr.push(c);
      bySuit.set(c.suit, arr);
    }

    for (const [, suitCards] of bySuit.entries()) {
      if (suitCards.length >= 3) {
        for (let i = 0; i <= suitCards.length - 3; i++) {
          const slice3 = suitCards.slice(i, i + 3);
          if (
            slice3[1].value === slice3[0].value + 1 &&
            slice3[2].value === slice3[1].value + 1
          ) {
            const slice3Ids = new Set(slice3.map((c) => c.id));
            for (const p of pairs) {
              if (slice3Ids.has(p[0].id) || slice3Ids.has(p[1].id)) continue;
              pushIfLegal(evaluateCombo([...slice3, ...p]));
            }
          }
        }
      }
    }
  }

  return validPlays;
}

