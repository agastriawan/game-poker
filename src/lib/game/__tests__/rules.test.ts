import assert from "node:assert/strict";
import {
  addPlayerToGame,
  createInitialGameState,
  getNormalScoreByRank,
  playCards,
  startNewRound,
  submitPlayerThrees,
} from "../engine";
import { canBeatPlay, evaluateCombo } from "../rules";
import { checkRedealCondition, dealFairHandsWithRedealCheck } from "../shuffle";
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

console.log("\n🎉 SEMUA UNIT TEST BERHASIL 100% TANPA ERROR!");

