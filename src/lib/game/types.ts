export type Suit = "spades" | "hearts" | "clubs" | "diamonds";

export type RankLabel =
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A"
  | "2";

/**
 * Nilai numerik kartu:
 * 3 = 3 ... 10 = 10, J = 11, Q = 12, K = 13, A = 14, 2 (Poker) = 15
 */
export type RankValue = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export interface Card {
  id: string; // e.g., "3-spades", "2-hearts"
  rank: RankLabel;
  value: RankValue;
  suit: Suit;
}

export type ComboType =
  | "single" // 1 kartu
  | "double" // 2 kartu angka sama
  | "triple" // 3 kartu angka sama
  | "straight_flush" // Seri sejenis >= 3 kartu (misal 3-4-5 sekop, 3-4-5-6-7 hati)
  | "full_house" // 3 kartu kembar + 2 kartu kembar buntut (misal 4-4-4-3-3)
  | "four_of_a_kind"; // 4 kartu kembar lengkap keempat lambang (Bom)

export interface PlayedCombo {
  type: ComboType;
  cards: Card[];
  /**
   * Nilai utama untuk perbandingan:
   * - single/double/triple/four_of_a_kind: nilai rank kartu tersebut
   * - straight_flush: nilai kartu tertinggi dalam seri tersebut
   * - full_house: nilai dari 3 kartu kembarnya (triplet)
   */
  primaryValue: RankValue;
  /** Jumlah kartu dalam kombinasi */
  length: number;
  /** Apakah langkah ini dieksekusi sebagai BOM terhadap 1 kartu Poker (2)? */
  isBombMove?: boolean;
  /** Deskripsi ramah pengguna, misal "Seri 3-4-5 Sekop" atau "BOM 4 Kartu Lima!" */
  label: string;
}

export type GamePhase =
  | "waiting" // Di lobby menunggu pemain (2-4 orang)
  | "collecting_threes" // Fase kumpul angka 3 di awal / setelah bom / setelah kocok ulang
  | "playing" // Permainan sedang berlangsung
  | "round_end"; // Ronde berakhir (Normal atau karena BOM)

export interface RedealEvent {
  attempt: number;
  reason: "no_royal" | "four_pokers";
  playerName: string;
  description: string;
  timestamp: number;
}

export interface CollectedThreeEntry {
  playerId: string;
  playerName: string;
  cards: Card[];
  hasThreeOfSpades: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  seatIndex: number;
  hand: Card[];
  /** Apakah sudah menekan/mengumpulkan angka 3 pada fase collecting_threes */
  hasSubmittedThrees: boolean;
  /** Kartu angka 3 yang dikumpulkan di awal ronde ini */
  collectedThrees: Card[];
  /** Apakah pemain sudah lewat (Pass) pada putaran trick saat ini */
  hasPassedThisTrick: boolean;
  /** Urutan selesai (1 = Juara 1, 2 = Juara 2, dst. null jika belum habis) */
  finishRank: number | null;
  /** Total poin akumulasi dari seluruh ronde */
  totalScore: number;
  /** Perubahan poin pada ronde terakhir */
  lastRoundDelta: number;
}

export interface TablePlay {
  playerId: string;
  playerName: string;
  combo: PlayedCombo;
  timestamp: number;
}

export interface BombResolution {
  bomberId: string;
  bomberName: string;
  victimId: string;
  victimName: string;
  bombCombo: PlayedCombo;
  pokerCard: Card;
}

export interface RoundSummary {
  roundNumber: number;
  endReason: "normal" | "bomb";
  bombResolution?: BombResolution;
  rankings: {
    playerId: string;
    playerName: string;
    rank: number | null;
    scoreDelta: number;
    newTotalScore: number;
    statusLabel: string;
  }[];
  nextRoundMode: "collect_threes" | "winner_starts";
  nextStarterId: string | null;
  nextStarterName: string | null;
}

export interface ShuffleMetadata {
  roundNumber: number;
  entropyHex: string;
  rifflePasses: number;
  cutIndex: number;
  similarityScoreMax: number;
  redealHistory: RedealEvent[];
  timestamp: number;
}

export interface GameState {
  roomCode: string;
  hostId: string;
  phase: GamePhase;
  roundNumber: number;
  /**
   * Apakah ronde ini wajib diawali dengan Kumpul Angka 3?
   * True jika: Ronde 1, atau habis kena BOM, atau habis terjadi Kocok Ulang (Redeal).
   * False jika: Ronde sebelumnya berakhir normal (Juara 1 jalan bebas).
   */
  mustCollectThrees: boolean;
  /** ID Juara 1 dari ronde normal sebelumnya (jika ada) */
  previousWinnerId: string | null;
  players: PlayerState[];
  /** ID pemain yang sedang mendapat giliran jalan */
  currentTurnPlayerId: string | null;
  /** Kombinasi kartu terakhir di meja yang harus dilawan (null jika meja kosong / bebas jalan) */
  currentTablePlay: TablePlay | null;
  /** Riwayat kartu yang dibuang dalam trick saat ini (untuk visualisasi meja) */
  trickPile: TablePlay[];
  /** Daftar kartu angka 3 yang terkumpul di meja pada fase kumpul 3 */
  collectedThreesPool: CollectedThreeEntry[];
  /** Urutan ID pemain yang sudah menghabiskan kartu di ronde ini */
  finishedOrder: string[];
  /** Ringkasan hasil akhir ronde saat phase === 'round_end' */
  roundSummary: RoundSummary | null;
  /** Informasi transparansi pengocokan kartu adil & log kocok ulang */
  shuffleMeta: ShuffleMetadata | null;
  /** Jejak kartu tangan ronde sebelumnya per playerId (untuk Anti-Similarity Guard) */
  previousHandsSignature: Record<string, string[]>;
  /** Log aktivitas terbaru di meja */
  logs: string[];
  updatedAt: number;
}

