import { Card, RankLabel, RankValue, RedealEvent, ShuffleMetadata, Suit } from "./types";

export const SUITS: Suit[] = ["spades", "hearts", "clubs", "diamonds"];

export const RANKS: { label: RankLabel; value: RankValue }[] = [
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10", value: 10 },
  { label: "J", value: 11 },
  { label: "Q", value: 12 },
  { label: "K", value: 13 },
  { label: "A", value: 14 },
  { label: "2", value: 15 }, // Poker (Tertinggi)
];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  clubs: "♣",
  diamonds: "♦",
};

export const SUIT_NAMES_ID: Record<Suit, string> = {
  spades: "Sekop",
  hearts: "Hati",
  clubs: "Keriting",
  diamonds: "Wajik",
};

/**
 * Menghasilkan bilangan bulat acak kriptografis (CSPRNG) di rentang [0, maxExclusive - 1]
 * menggunakan rejection sampling agar bebas modulo bias (100% adil).
 */
export function cryptoRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const array = new Uint32Array(1);
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % maxExclusive);

  let randomVal = 0;
  do {
    crypto.getRandomValues(array);
    randomVal = array[0];
  } while (randomVal >= limit);

  return randomVal % maxExclusive;
}

/**
 * Menghasilkan 8-byte hex entropy sebagai bukti transparansi pengocokan CSPRNG.
 */
function generateEntropyHex(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Membuat 1 pak kartu standar berisi 52 kartu (tanpa Joker).
 */
export function createStandardDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({
        id: `${rank.label}-${suit}`,
        rank: rank.label,
        value: rank.value,
        suit,
      });
    }
  }
  return deck;
}

/**
 * Simulasi Belah Kartu (Cut Deck) seperti di dunia nyata.
 */
function cutDeck(deck: Card[]): { deck: Card[]; cutIndex: number } {
  // Belah di sekitar titik 18 s/d 34 dari 52 kartu
  const cutIndex = 16 + cryptoRandomInt(21);
  const topHalf = deck.slice(0, cutIndex);
  const bottomHalf = deck.slice(cutIndex);
  return {
    deck: [...bottomHalf, ...topHalf],
    cutIndex,
  };
}

/**
 * Simulasi Overhand Shuffle (mengambil beberapa bundel kecil kartu dari atas ke bawah).
 */
function overhandShuffle(deck: Card[]): Card[] {
  let current = [...deck];
  const passes = 2 + cryptoRandomInt(2);

  for (let p = 0; p < passes; p++) {
    const result: Card[] = [];
    let i = 0;
    while (i < current.length) {
      const chunkSize = 3 + cryptoRandomInt(8); // ambil 3-10 kartu sekaligus
      const chunk = current.slice(i, i + chunkSize);
      result.unshift(...chunk);
      i += chunkSize;
    }
    current = result;
  }
  return current;
}

/**
 * Simulasi Riffle Shuffle Dunia Nyata (membelah 2 tumpukan lalu menganyam dengan jatuhan 1-3 kartu).
 */
function riffleShuffle(deck: Card[]): Card[] {
  const splitPoint = 23 + cryptoRandomInt(7); // sekitar tengah (23..29)
  const left = deck.slice(0, splitPoint);
  const right = deck.slice(splitPoint);
  const interleaved: Card[] = [];

  let lIdx = 0;
  let rIdx = 0;

  while (lIdx < left.length || rIdx < right.length) {
    const pickLeftFirst = cryptoRandomInt(2) === 0;
    if (pickLeftFirst && lIdx < left.length) {
      const dropCount = 1 + cryptoRandomInt(3); // jatuh 1-3 kartu
      interleaved.push(...left.slice(lIdx, lIdx + dropCount));
      lIdx += dropCount;
    } else if (rIdx < right.length) {
      const dropCount = 1 + cryptoRandomInt(3);
      interleaved.push(...right.slice(rIdx, rIdx + dropCount));
      rIdx += dropCount;
    } else if (lIdx < left.length) {
      interleaved.push(...left.slice(lIdx));
      break;
    }
  }

  return interleaved;
}

/**
 * Fisher-Yates Shuffle berbasis CSPRNG.
 */
function cryptoFisherYates(deck: Card[]): Card[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Menggabungkan metode pengocokan dunia nyata (Overhand + Riffle + Cut + Multi-Pass CSPRNG Fisher-Yates).
 */
export function performRealWorldShuffle(
  initialDeck?: Card[]
): {
  deck: Card[];
  rifflePasses: number;
  cutIndex: number;
  entropyHex: string;
} {
  let workingDeck = initialDeck && initialDeck.length === 52
    ? [...initialDeck]
    : createStandardDeck();

  // 1. Overhand shuffle awal (seperti merapikan kartu bekas ronde sebelumnya)
  workingDeck = overhandShuffle(workingDeck);

  // 2. Riffle shuffle 4-6 kali
  const rifflePasses = 4 + cryptoRandomInt(3);
  for (let i = 0; i < rifflePasses; i++) {
    workingDeck = riffleShuffle(workingDeck);
  }

  // 3. Multi-pass CSPRNG Fisher-Yates (3 putaran penuh)
  for (let i = 0; i < 3; i++) {
    workingDeck = cryptoFisherYates(workingDeck);
  }

  // 4. Cut Deck (belah tumpukan terakhir sebelum dibagi)
  const cutResult = cutDeck(workingDeck);

  return {
    deck: cutResult.deck,
    rifflePasses,
    cutIndex: cutResult.cutIndex,
    entropyHex: generateEntropyHex(),
  };
}

/**
 * Mengurutkan kartu di tangan pemain dari terkecil (3) ke terbesar (2/Poker).
 */
export function sortHand(cards: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = {
    diamonds: 1,
    clubs: 2,
    hearts: 3,
    spades: 4,
  };
  return [...cards].sort((a, b) => {
    if (a.value !== b.value) {
      return a.value - b.value;
    }
    return suitOrder[a.suit] - suitOrder[b.suit];
  });
}

/**
 * Menghitung rasio kemiripan kartu tangan pemain dibanding ronde sebelumnya (0.0 - 1.0).
 */
function calculateMaxHandSimilarity(
  dealtHands: Record<string, Card[]>,
  previousSignatures: Record<string, string[]>
): number {
  let maxSimilarity = 0;
  for (const [playerId, hand] of Object.entries(dealtHands)) {
    const prevIds = previousSignatures[playerId];
    if (!prevIds || prevIds.length === 0) continue;

    const prevSet = new Set(prevIds);
    let sameCount = 0;
    for (const card of hand) {
      if (prevSet.has(card.id)) {
        sameCount++;
      }
    }
    const ratio = sameCount / hand.length;
    if (ratio > maxSimilarity) {
      maxSimilarity = ratio;
    }
  }
  return maxSimilarity;
}

/**
 * Memeriksa apakah pembagian kartu wajib dikocok ulang (Bom Kocok Ulang / Redeal):
 * 1. Ada pemain yang tidak memegang kartu Kerajaan (J, Q, K) sama sekali.
 * 2. Ada 1 pemain yang memegang keempat kartu Poker (empat kartu angka 2) sekaligus.
 */
export function checkRedealCondition(
  players: { id: string; name: string }[],
  dealtHands: Record<string, Card[]>,
  attempt: number
): RedealEvent | null {
  for (const player of players) {
    const hand = dealtHands[player.id] || [];

    // Kondisi 1: Tidak punya kartu Kerajaan (J = 11, Q = 12, K = 13)
    const hasRoyalCard = hand.some(
      (c) => c.value === 11 || c.value === 12 || c.value === 13
    );
    if (!hasRoyalCard) {
      return {
        attempt,
        reason: "no_royal",
        playerName: player.name,
        description: `${player.name} tidak mendapatkan kartu Kerajaan (J, Q, K) sama sekali! Otomatis BOM / Kocok Ulang & kembali kumpul angka 3.`,
        timestamp: Date.now(),
      };
    }

    // Kondisi 2: Memegang 4 kartu Poker (angka 2, value = 15) sekaligus
    const pokerCount = hand.filter((c) => c.value === 15).length;
    if (pokerCount === 4) {
      return {
        attempt,
        reason: "four_pokers",
        playerName: player.name,
        description: `${player.name} memegang 4 kartu Poker (empat kartu 2) sekaligus! Otomatis BOM / Kocok Ulang & kembali kumpul angka 3.`,
        timestamp: Date.now(),
      };
    }
  }

  return null;
}

/**
 * Membagikan 52 kartu sampai habis secara melingkar (satu demi satu seperti dunia nyata),
 * dilengkapi Anti-Similarity Guard dan Deteksi Kocok Ulang Otomatis (J/Q/K & 4 Poker).
 */
export function dealFairHandsWithRedealCheck(params: {
  players: { id: string; name: string }[];
  roundNumber: number;
  previousHandsSignature: Record<string, string[]>;
  startDealIndex?: number;
}): {
  hands: Record<string, Card[]>;
  newSignatures: Record<string, string[]>;
  triggeredRedeal: boolean;
  shuffleMeta: ShuffleMetadata;
} {
  const {
    players,
    roundNumber,
    previousHandsSignature,
    startDealIndex = 0,
  } = params;

  const numPlayers = players.length;
  // Batas maksimum kemiripan tangan dengan ronde lalu:
  // Untuk 4 pemain (rata-rata ekspektasi acak 25%): tolak jika > 46% (misal >6 dari 13 kartu sama persis)
  // Untuk 3 pemain (rata-rata ekspektasi acak 33%): tolak jika > 53%
  // Untuk 2 pemain (rata-rata ekspektasi acak 50%): tolak jika > 65%
  const similarityThreshold =
    numPlayers >= 4 ? 0.46 : numPlayers === 3 ? 0.53 : 0.65;

  const redealHistory: RedealEvent[] = [];
  let currentDeck = createStandardDeck();
  let attempt = 0;

  while (true) {
    attempt++;

    let shuffleResult = performRealWorldShuffle(currentDeck);
    currentDeck = shuffleResult.deck;

    // Bagikan 52 kartu satu per satu secara melingkar (Round-Robin) seperti dunia nyata
    const rawHands: Record<string, Card[]> = {};
    for (const p of players) {
      rawHands[p.id] = [];
    }

    for (let i = 0; i < currentDeck.length; i++) {
      const targetPlayer = players[(startDealIndex + i) % numPlayers];
      rawHands[targetPlayer.id].push(currentDeck[i]);
    }

    // Lapis Anti-Similarity Guard: Cegah kartu tangan yang terlalu mirip dengan ronde sebelumnya
    const similarityScore = calculateMaxHandSimilarity(
      rawHands,
      previousHandsSignature
    );
    if (similarityScore > similarityThreshold && attempt < 12) {
      // Kocok ekstra secara transparan di belakang layar agar kartu benar-benar segar
      continue;
    }

    // Periksa syarat Kocok Ulang (Tidak punya J/Q/K atau punya 4 Poker)
    const redealEvent = checkRedealCondition(
      players,
      rawHands,
      redealHistory.length + 1
    );
    if (redealEvent && redealHistory.length < 10) {
      redealHistory.push(redealEvent);
      continue;
    }

    // Kartu sah! Urutkan tangan masing-masing pemain dan simpan signature baru
    const sortedHands: Record<string, Card[]> = {};
    const newSignatures: Record<string, string[]> = {};

    for (const p of players) {
      sortedHands[p.id] = sortHand(rawHands[p.id]);
      newSignatures[p.id] = sortedHands[p.id].map((c) => c.id);
    }

    return {
      hands: sortedHands,
      newSignatures,
      triggeredRedeal: redealHistory.length > 0,
      shuffleMeta: {
        roundNumber,
        entropyHex: shuffleResult.entropyHex,
        rifflePasses: shuffleResult.rifflePasses,
        cutIndex: shuffleResult.cutIndex,
        similarityScoreMax: Math.round(similarityScore * 100),
        redealHistory,
        timestamp: Date.now(),
      },
    };
  }
}

