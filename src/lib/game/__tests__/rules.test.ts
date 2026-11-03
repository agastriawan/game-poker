import assert from "node:assert/strict";
import {
  addPlayerToGame,
  createInitialGameState,
  forfeitPlayer,
  getNormalScoreByRank,
  passTurn,
  playCards,
  startNewRound,
  submitPlayerThrees,
  togglePlayerReady,
  updatePlayerProfile,
} from "../engine";
import {
  canBeatPlay,
  checkPokerLastCardViolation,
  evaluateCombo,
  findAllValidPlays,
} from "../rules";
import { checkRedealCondition, dealFairHandsWithRedealCheck } from "../shuffle";
import { getNextBotAction } from "../bot";
import { Card } from "../types";

function makeCard(
  rank: Card["rank"],
  value: Card["value"],
  suit: Card["suit"]
): Card {
  return { id: `${rank}-${suit}`, rank, value, suit };
}

console.log("=== Menjalankan Unit Test Aturan Game Poker Online ===");

// 1. Uji Single & Kesetaraan Lambang
{
  const c3Spade = evaluateCombo([makeCard("3", 3, "spades")])!;
  const c4Heart = evaluateCombo([makeCard("4", 4, "hearts")])!;
  const c4Spade = evaluateCombo([makeCard("4", 4, "spades")])!;

  assert.equal(canBeatPlay(c4Heart, c3Spade).valid, true, "4 Hati harus bisa mengalahkan 3 Sekop");
  assert.equal(
    canBeatPlay(c4Spade, c4Heart).valid,
    false,
    "4 Sekop tidak boleh mengalahkan 4 Hati karena nilai angka sama"
  );
  console.log("✅ [PASS] Aturan Single & Kesetaraan Lambang");
}

// 2. Uji Seri Sejenis (Straight Flush) & Lawan Beda Lambang
{
  const mixedStraight = evaluateCombo([
    makeCard("3", 3, "spades"),
    makeCard("4", 4, "hearts"),
    makeCard("5", 5, "spades"),
  ]);
  assert.equal(mixedStraight, null, "Seri beda lambang harus tidak sah");

  const sfSpades = evaluateCombo([
    makeCard("3", 3, "spades"),
    makeCard("4", 4, "spades"),
    makeCard("5", 5, "spades"),
  ])!;
  const sfHeartsHigher = evaluateCombo([
    makeCard("4", 4, "hearts"),
    makeCard("5", 5, "hearts"),
    makeCard("6", 6, "hearts"),
  ])!;

  assert.equal(sfSpades.type, "straight_flush");
  assert.equal(
    canBeatPlay(sfHeartsHigher, sfSpades).valid,
    true,
    "Seri 3-4-5 Sekop harus bisa dilawan dengan 4-5-6 Hati"
  );
  console.log("✅ [PASS] Aturan Seri Sejenis (3-4-5 Sekop dilawan 4-5-6 Hati)");
}

// 3. Uji Full House (3 Kembar + 2 Buntut)
{
  const fh4 = evaluateCombo([
    makeCard("4", 4, "spades"),
    makeCard("4", 4, "hearts"),
    makeCard("4", 4, "clubs"),
    makeCard("3", 3, "spades"),
    makeCard("3", 3, "diamonds"),
  ])!;
  const fh5 = evaluateCombo([
    makeCard("5", 5, "spades"),
    makeCard("5", 5, "hearts"),
    makeCard("5", 5, "clubs"),
    makeCard("3", 3, "hearts"),
    makeCard("3", 3, "clubs"),
  ])!;

  assert.equal(fh4.type, "full_house");
  assert.equal(fh4.primaryValue, 4);
  assert.equal(canBeatPlay(fh5, fh4).valid, true, "Full House 5 harus mengalahkan Full House 4");
  console.log("✅ [PASS] Aturan Full House (4-4-4 buntut 3-3)");
}

// 4. Uji Aturan BOM terhadap Single Poker (2) & Kebal untuk Double Poker
{
  const singlePoker = evaluateCombo([makeCard("2", 15, "spades")])!;
  const doublePoker = evaluateCombo([
    makeCard("2", 15, "spades"),
    makeCard("2", 15, "hearts"),
  ])!;

  const quadThreeBomb = evaluateCombo([
    makeCard("3", 3, "spades"),
    makeCard("3", 3, "hearts"),
    makeCard("3", 3, "clubs"),
    makeCard("3", 3, "diamonds"),
  ])!;

  const fiveStraightFlushBomb = evaluateCombo([
    makeCard("3", 3, "spades"),
    makeCard("4", 4, "spades"),
    makeCard("5", 5, "spades"),
    makeCard("6", 6, "spades"),
    makeCard("7", 7, "spades"),
  ])!;

  const checkQuadVsSingle = canBeatPlay(quadThreeBomb, singlePoker);
  assert.equal(checkQuadVsSingle.valid, true);
  assert.equal(checkQuadVsSingle.isBomb, true, "4 kartu 3 lengkap harus bisa BOM 1 Poker");

  const checkSF5VsSingle = canBeatPlay(fiveStraightFlushBomb, singlePoker);
  assert.equal(checkSF5VsSingle.valid, true);
  assert.equal(checkSF5VsSingle.isBomb, true, "Seri 5 kartu sejenis harus bisa BOM 1 Poker");

  const checkQuadVsDouble = canBeatPlay(quadThreeBomb, doublePoker);
  assert.equal(checkQuadVsDouble.valid, false, "Double Poker TIDAK BOLEH bisa di-bom!");
  console.log("✅ [PASS] Aturan BOM (Single Poker bisa di-bom, Double Poker kebal bom)");
}

// 5. Uji Deteksi Kocok Ulang (Tidak punya J/Q/K atau Punya 4 Poker)
{
  const players = [
    { id: "p1", name: "Andi" },
    { id: "p2", name: "Budi" },
  ];

  const handNoRoyal = [
    makeCard("3", 3, "spades"),
    makeCard("4", 4, "hearts"),
    makeCard("A", 14, "clubs"),
    makeCard("2", 15, "diamonds"),
  ];
  const handNormal = [makeCard("J", 11, "spades")];

  const redeal1 = checkRedealCondition(
    players,
    { p1: handNoRoyal, p2: handNormal },
    1
  );
  assert.notEqual(redeal1, null);
  assert.equal(redeal1?.reason, "no_royal", "Harus mendeteksi ketiadaan J/Q/K (A dan 2 bukan kerajaan)");

  const handFourPokers = [
    makeCard("J", 11, "spades"),
    makeCard("2", 15, "spades"),
    makeCard("2", 15, "hearts"),
    makeCard("2", 15, "clubs"),
    makeCard("2", 15, "diamonds"),
  ];
  const redeal2 = checkRedealCondition(
    players,
    { p1: handFourPokers, p2: handNormal },
    1
  );
  assert.notEqual(redeal2, null);
  assert.equal(redeal2?.reason, "four_pokers", "Harus mendeteksi 4 kartu Poker di 1 tangan");
  console.log("✅ [PASS] Deteksi Kocok Ulang (Murni J/Q/K & 4 Poker)");
}

// 6. Uji Pembagian 52 Kartu Habis (4, 3, dan 2 Pemain) & Fase Kumpul 3 + Skenario BOM
{
  for (const count of [2, 3, 4]) {
    const pList = Array.from({ length: count }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
    }));
    const deal = dealFairHandsWithRedealCheck({
      players: pList,
      roundNumber: 1,
      previousHandsSignature: {},
    });
    const totalDealt = Object.values(deal.hands).reduce(
      (acc, h) => acc + h.length,
      0
    );
    assert.equal(totalDealt, 52, `Total kartu untuk ${count} pemain harus 52`);
  }

  // Simulasi Game 4 Pemain: Kumpul Angka 3 -> Pemilik 3 Sekop Jalan -> Bom -> Reset ke Kumpul 3
  let state = createInitialGameState({
    roomCode: "TEST01",
    hostId: "p1",
    hostName: "Andi",
  });
  state = addPlayerToGame(state, { id: "p2", name: "Budi", isBot: false });
  state = addPlayerToGame(state, { id: "p3", name: "Cici", isBot: false });
  state = addPlayerToGame(state, { id: "p4", name: "Dedi", isBot: false });

  // Uji ubah nama dan avatar di waiting room
  state = updatePlayerProfile(state, "p2", { name: "Budi Pro", seatIndex: 2 });
  assert.equal(state.players.find((p) => p.id === "p2")?.name, "Budi Pro");
  assert.equal(state.players.find((p) => p.id === "p2")?.seatIndex, 2);

  // Uji aturan: semua pemain harus Ready di waiting room sebelum start
  assert.throws(
    () => startNewRound(state),
    /Semua pemain harus menekan Siap \(Ready\) dahulu!/
  );

  // Semua pemain menekan Siap (Ready)
  for (const p of state.players) {
    state = togglePlayerReady(state, p.id);
  }
  assert.equal(state.players.every((p) => p.isReady), true);

  state = startNewRound(state);
  assert.equal(state.phase, "collecting_threes");

  // Cari siapa yang pegang 3-spades sebelum dikumpulkan
  const holderOf3Spades = state.players.find((p) =>
    p.hand.some((c) => c.id === "3-spades")
  )!;

  for (const p of state.players) {
    state = submitPlayerThrees(state, p.id);
  }

  assert.equal(state.phase, "playing");
  assert.equal(
    state.currentTurnPlayerId,
    holderOf3Spades.id,
    "Pemilik 3 Sekop wajib mendapat giliran pertama setelah kumpul angka 3"
  );

  // Uji perhitungan poin 4 pemain
  assert.equal(getNormalScoreByRank(4, 1), 30);
  assert.equal(getNormalScoreByRank(4, 2), 20);
  assert.equal(getNormalScoreByRank(4, 3), 10);
  assert.equal(getNormalScoreByRank(4, 4), -10);

  // Simulasi BOM saat 1 Poker dikeluarkan
  const turnPlayerIdx = state.players.findIndex(
    (p) => p.id === state.currentTurnPlayerId
  );
  const bomberIdx = (turnPlayerIdx + 1) % 4;
  const turnPlayer = state.players[turnPlayerIdx];
  const bomberPlayer = state.players[bomberIdx];

  // Berikan 2-spades ke turnPlayer dan 4 kartu angka 5 ke bomberPlayer untuk test deterministik
  turnPlayer.hand = [makeCard("2", 15, "spades"), makeCard("8", 8, "hearts")];
  bomberPlayer.hand = [
    makeCard("5", 5, "spades"),
    makeCard("5", 5, "hearts"),
    makeCard("5", 5, "clubs"),
    makeCard("5", 5, "diamonds"),
    makeCard("9", 9, "clubs"),
  ];

  state = playCards(state, turnPlayer.id, ["2-spades"]);
  assert.equal(state.currentTablePlay?.combo.primaryValue, 15);

  // Bomber mengebom Single 2!
  state = playCards(state, bomberPlayer.id, [
    "5-spades",
    "5-hearts",
    "5-clubs",
    "5-diamonds",
  ]);

  assert.equal(state.phase, "round_end", "Permainan harus langsung berakhir saat ada BOM");
  assert.equal(
    state.mustCollectThrees,
    true,
    "Setelah BOM, ronde berikutnya wajib kembali mengumpulkan angka 3"
  );

  const updatedBomber = state.players.find((p) => p.id === bomberPlayer.id)!;
  const updatedVictim = state.players.find((p) => p.id === turnPlayer.id)!;
  assert.equal(updatedBomber.totalScore, 10, "Pengebom harus mendapat +10 poin");
  assert.equal(updatedVictim.totalScore, -10, "Korban Bom harus terkena -10 poin");

  console.log("✅ [PASS] Alur Kumpul 3, Pemilik 3♠ Jalan Pertama, Eksekusi BOM (+10/-10), & Reset Kumpul 3");
}

// 7. Uji Aturan Baru: Kartu Poker (2) TIDAK BOLEH ditaruh / disisakan di paling akhir
{
  const handWithPokerAndNormal = [
    makeCard("8", 8, "hearts"),
    makeCard("2", 15, "spades"),
  ];

  // Membuang 8♥ dulu menyisakan hanya 2♠ di paling akhir -> harus melanggar!
  const v1 = checkPokerLastCardViolation(handWithPokerAndNormal, [
    makeCard("8", 8, "hearts"),
  ]);
  assert.equal(
    v1.violates,
    true,
    "Membuang kartu biasa yang menyisakan hanya Poker (2) di akhir harus dilarang"
  );

  // Membuang 2♠ dulu menyisakan 8♥ di akhir -> harus sah!
  const v2 = checkPokerLastCardViolation(handWithPokerAndNormal, [
    makeCard("2", 15, "spades"),
  ]);
  assert.equal(
    v2.violates,
    false,
    "Membuang Poker (2) terlebih dahulu dan menyisakan 8♥ harus diizinkan"
  );

  // Membuang 2♠ sebagai kartu terakhir (sisa 0) -> harus melanggar!
  const v3 = checkPokerLastCardViolation(
    [makeCard("2", 15, "spades")],
    [makeCard("2", 15, "spades")]
  );
  assert.equal(
    v3.violates,
    true,
    "Menutup permainan dengan kartu Poker (2) di paling akhir harus dilarang"
  );

  // Pastikan findAllValidPlays hanya menyarankan buang 2♠ dulu saat memegang [8♥, 2♠]
  const validMoves = findAllValidPlays(handWithPokerAndNormal, null);
  assert.equal(validMoves.length, 1);
  assert.equal(
    validMoves[0].cards[0].id,
    "2-spades",
    "Saran langkah valid wajib memilih 2♠ terlebih dahulu agar Poker tidak di paling akhir"
  );

  console.log("✅ [PASS] Aturan Baru: Kartu Poker (2) Tidak Boleh Ditaruh di Paling Akhir");
}

// 8. Uji Full House Seri Sejenis + 2 Buntut (Contoh: 9♦ 10♦ J♦ + 5♥ 5♠)
{
  const fhSeri910J = evaluateCombo([
    makeCard("5", 5, "hearts"),
    makeCard("5", 5, "spades"),
    makeCard("9", 9, "diamonds"),
    makeCard("10", 10, "diamonds"),
    makeCard("J", 11, "diamonds"),
  ]);

  assert.notEqual(fhSeri910J, null, "9-10-J wajik + 5-5 buntut harus diakui sebagai kombinasi sah");
  assert.equal(fhSeri910J?.type, "full_house");
  assert.equal(fhSeri910J?.primaryValue, 11, "Primary value harus nilai kartu tertinggi seri (J = 11)");

  // Full House klasik 8 (8-8-8 + 3-3, primaryValue 8)
  const fh8 = evaluateCombo([
    makeCard("8", 8, "spades"),
    makeCard("8", 8, "hearts"),
    makeCard("8", 8, "clubs"),
    makeCard("3", 3, "spades"),
    makeCard("3", 3, "hearts"),
  ])!;

  assert.equal(
    canBeatPlay(fhSeri910J!, fh8).valid,
    true,
    "Full House Seri 9-10-J (11) harus bisa mengalahkan Full House 8 (8)"
  );

  // Full House klasik Q (Q-Q-Q + 3-3, primaryValue 12)
  const fhQ = evaluateCombo([
    makeCard("Q", 12, "spades"),
    makeCard("Q", 12, "hearts"),
    makeCard("Q", 12, "clubs"),
    makeCard("3", 3, "spades"),
    makeCard("3", 3, "hearts"),
  ])!;

  assert.equal(
    canBeatPlay(fhQ, fhSeri910J!).valid,
    true,
    "Full House Q (12) harus bisa mengalahkan Full House Seri 9-10-J (11)"
  );

  console.log("✅ [PASS] Aturan Full House Seri Sejenis + 2 Buntut (9-10-J♦ + 5♥ 5♠)");
}

// 9. Uji Pemain A Habis Kartu, Seluruh Lawan Pass -> Pemain Setelah A Bebas Mengeluarkan Kartu Apapun
{
  let state = createInitialGameState({
    roomCode: "TEST99",
    hostId: "user-a",
    hostName: "Pemain A",
  });
  state = addPlayerToGame(state, { id: "user-b", name: "Pemain B", isBot: false });
  state = addPlayerToGame(state, { id: "user-c", name: "Pemain C", isBot: false });

  // Set kartu: A sisa 1 kartu (K♠), B punya [4♥, 5♥], C punya [6♥, 7♥]
  state = {
    ...state,
    phase: "playing",
    currentTurnPlayerId: "user-a",
    currentTablePlay: null,
    players: [
      {
        ...state.players[0],
        hand: [makeCard("K", 13, "spades")],
        finishRank: null,
      },
      {
        ...state.players[1],
        hand: [makeCard("4", 4, "hearts"), makeCard("5", 5, "hearts")],
        finishRank: null,
      },
      {
        ...state.players[2],
        hand: [makeCard("6", 6, "hearts"), makeCard("7", 7, "hearts")],
        finishRank: null,
      },
    ],
  };

  // 1. Pemain A mengeluarkan kartu K♠ dan menghabiskan seluruh kartunya
  state = playCards(state, "user-a", ["K-spades"]);
  assert.equal(state.players[0].finishRank, 1, "Pemain A harus selesai sebagai Juara 1");
  assert.equal(state.currentTurnPlayerId, "user-b", "Giliran harus pindah ke Pemain B");
  assert.notEqual(state.currentTablePlay, null, "Meja berisi kartu K♠ dari Pemain A");

  // 2. Pemain B tidak membantai kartu A -> B memilih Lewat (Pass)
  state = passTurn(state, "user-b");
  assert.equal(state.currentTurnPlayerId, "user-c", "Giliran harus pindah ke Pemain C");

  // 3. Pemain C juga tidak membantai kartu A -> C memilih Lewat (Pass)
  state = passTurn(state, "user-c");

  // Seluruh pemain aktif (B dan C) telah pass terhadap kartu A!
  // Meja harus dikosongkan dan Pemain B (pemain setelah A) bebas mengeluarkan kartu apapun!
  assert.equal(state.currentTablePlay, null, "Meja harus bersih (null)");
  assert.equal(state.currentTurnPlayerId, "user-b", "Giliran bebas harus jatuh ke Pemain B (pemain setelah A)");
  assert.equal(state.players[1].hasPassedThisTrick, false, "Status pass Pemain B harus sudah di-reset");

  // Pemain B mencoba mengeluarkan kartu bebas (misal 4♥)
  state = playCards(state, "user-b", ["4-hearts"]);
  assert.equal(state.players[1].hand.length, 1, "Pemain B sukses mengeluarkan kartu pada giliran bebasnya");

  console.log("✅ [PASS] Aturan Pemain A Habis Kartu, Semua Lawan Pass -> Pemain Setelah A Bebas Jalan");
}

function testPlayerForfeitKeepsGameRunning() {
  let state = createInitialGameState({
    roomCode: "FRFT01",
    hostId: "user-a",
    hostName: "Pemain A",
  });
  state = addPlayerToGame(state, { id: "user-b", name: "Pemain B", isBot: false });
  state = addPlayerToGame(state, { id: "user-c", name: "Pemain C", isBot: false });
  state = addPlayerToGame(state, { id: "user-d", name: "Pemain D", isBot: false });

  state = {
    ...state,
    phase: "playing",
    currentTurnPlayerId: "user-d",
    currentTablePlay: null,
    players: [
      {
        ...state.players[0],
        hand: [makeCard("A", 14, "spades")],
        finishRank: null,
      },
      {
        ...state.players[1],
        hand: [makeCard("4", 4, "hearts"), makeCard("5", 5, "hearts")],
        finishRank: null,
      },
      {
        ...state.players[2],
        hand: [makeCard("6", 6, "hearts"), makeCard("7", 7, "hearts")],
        finishRank: null,
      },
      {
        ...state.players[3],
        hand: [makeCard("8", 8, "hearts"), makeCard("9", 9, "hearts")],
        finishRank: null,
      },
    ],
  };

  // 1. Pemain D keluar duluan (sedang giliran D)
  state = forfeitPlayer(state, "user-d");
  assert.equal(state.phase, "playing", "Permainan harus tetap berlanjut saat 1 pemain keluar!");
  assert.equal(state.players[3].finishRank, 4, "Pemain D yang keluar pertama harus dapat rank #4");
  assert.equal(state.players[3].lastRoundDelta, -10, "Pemain D harus kena penalti -10 poin");
  assert.equal(state.players[3].isForfeited, true, "Pemain D harus ditandai isForfeited");
  assert.equal(state.currentTurnPlayerId, "user-a", "Giliran harus otomatis oper ke pemain aktif berikutnya (A)");

  // 2. Pemain C keluar berikutnya
  state = forfeitPlayer(state, "user-c");
  assert.equal(state.phase, "playing", "Permainan harus tetap berlanjut!");
  assert.equal(state.players[2].finishRank, 3, "Pemain C yang keluar kedua harus dapat rank #3");
  assert.equal(state.players[2].lastRoundDelta, -10, "Pemain C harus kena penalti -10 poin");

  // 3. Sekarang tersisa 2 pemain aktif: A dan B. Pemain A menghabiskan kartunya!
  state = playCards(state, "user-a", ["A-spades"]);
  assert.equal(state.players[0].finishRank, 1, "Pemain A harus mendapat Juara #1");

  // Hanya tersisa 1 orang aktif (B), sehingga ronde berakhir otomatis!
  assert.equal(state.phase, "round_end", "Ronde harus selesai saat hanya tersisa 1 pemain");
  assert.equal(state.players[1].finishRank, 2, "Pemain B yang tersisa harus otomatis mendapat rank #2");
  assert.equal(state.players[0].lastRoundDelta, 30, "Juara 1 dalam mode 4 pemain dapat +30");
  assert.equal(state.players[1].lastRoundDelta, 20, "Juara 2 dalam mode 4 pemain dapat +20");

  console.log("✅ [PASS] Aturan Pemain Keluar: Langsung Kalah (#4, #3), Game Tetap Lanjut Sampai Sisa 1 Orang");
}

testPlayerForfeitKeepsGameRunning();

// 11. Uji Kecerdasan Bot & Tingkat Kesulitan (Easy, Medium, Hard)
function testBotIntelligenceAndDifficulty() {
  // Scenario A: Lawan sisa 1 kartu -> Bot Medium/Hard DILARANG buang single kecil jika punya kombo
  let state = createInitialGameState({
    roomCode: "BOTA11",
    hostId: "user-human",
    hostName: "Pemain Manusia",
  });
  state = addPlayerToGame(state, { id: "bot-1", name: "Bot Himiya", isBot: true });
  state = {
    ...state,
    phase: "playing",
    botDifficulty: "medium",
    currentTurnPlayerId: "bot-1",
    currentTablePlay: null,
    players: [
      {
        ...state.players[0],
        hand: [makeCard("A", 14, "spades")], // Manusia sisa 1 kartu!
        finishRank: null,
      },
      {
        ...state.players[1],
        hand: [
          makeCard("4", 4, "diamonds"),
          makeCard("5", 5, "hearts"),
          makeCard("5", 5, "spades"),
        ],
        finishRank: null,
      },
    ],
  };

  const action = getNextBotAction(state);
  assert.equal(action?.actionType, "play");
  assert.equal(action?.cardIds?.length, 2, "Bot Medium harus melempar Pair 5-5 daripada single 4 saat lawan sisa 1 kartu!");

  // Scenario B: Bot hanya punya single [4♦, K♠, 2♣] dan lawan sisa 1 kartu -> Bot Medium/Hard harus melempar single tertinggi (2♣ atau K♠), BUKAN 4♦
  state = {
    ...state,
    botDifficulty: "medium",
    players: [
      {
        ...state.players[0],
        hand: [makeCard("9", 9, "hearts")], // Lawan sisa 1 kartu
        finishRank: null,
      },
      {
        ...state.players[1],
        hand: [
          makeCard("4", 4, "diamonds"),
          makeCard("K", 13, "spades"),
          makeCard("2", 15, "clubs"),
        ],
        finishRank: null,
      },
    ],
  };
  const actionB = getNextBotAction(state);
  assert.equal(actionB?.actionType, "play");
  assert.notEqual(actionB?.cardIds?.[0], "4-diamonds", "Bot tidak boleh buang 4♦ yang memberi kemenangan gratis ke lawan 1 kartu!");

  // Scenario C: Hard Mode Tactical Pass (Menahan kartu sakti 2 saat meja berisi kartu kecil dan tidak darurat)
  state = {
    ...state,
    botDifficulty: "hard",
    currentTablePlay: {
      playerId: "user-human",
      playerName: "Pemain Manusia",
      combo: evaluateCombo([makeCard("8", 8, "hearts")])!,
      timestamp: Date.now(),
    },
    players: [
      {
        ...state.players[0],
        hand: [
          makeCard("9", 9, "hearts"),
          makeCard("10", 10, "hearts"),
          makeCard("J", 11, "hearts"),
          makeCard("Q", 12, "hearts"),
        ],
        finishRank: null,
      },
      {
        ...state.players[1],
        hand: [
          makeCard("4", 4, "diamonds"),
          makeCard("5", 5, "clubs"),
          makeCard("6", 6, "spades"),
          makeCard("7", 7, "hearts"),
          makeCard("2", 15, "spades"), // Satu-satunya yang bisa melawan 8 adalah 2
        ],
        finishRank: null,
      },
    ],
  };
  const actionC = getNextBotAction(state);
  assert.equal(actionC?.actionType, "pass", "Bot Hard mode harus Pass secara taktis untuk menyimpan kartu 2!");

  console.log("✅ [PASS] Kecerdasan Bot & Tingkat Kesulitan: Anti-Kebobolan 1 Kartu Lawan & Tactical Pass");
}

testBotIntelligenceAndDifficulty();

console.log("\n🎉 SEMUA UNIT TEST BERHASIL 100% TANPA ERROR!");

