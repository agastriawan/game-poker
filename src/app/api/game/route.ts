import { NextRequest, NextResponse } from "next/server";
import {
  addPlayerToGame,
  createInitialGameState,
  forfeitPlayer,
  passTurn,
  playCards,
  removePlayerFromGame,
  sendTaunt,
  startNewRound,
  submitPlayerThrees,
} from "@/lib/game/engine";
import { GameState } from "@/lib/game/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, state, payload } = body as {
      action:
        | "create_room"
        | "join_room"
        | "remove_player"
        | "start_round"
        | "submit_threes"
        | "play_cards"
        | "pass_turn"
        | "send_taunt"
        | "forfeit_game";
      state?: GameState;
      payload?: Record<string, unknown>;
    };

    let nextState: GameState;

    switch (action) {
      case "create_room": {
        const roomCode = String(payload?.roomCode || "POKR01");
        const hostId = String(payload?.hostId || "host-1");
        const hostName = String(payload?.hostName || "Pemain 1");
        nextState = createInitialGameState({ roomCode, hostId, hostName });
        break;
      }

      case "join_room": {
        if (!state) throw new Error("State room tidak ditemukan.");
        nextState = addPlayerToGame(state, {
          id: String(payload?.playerId),
          name: String(payload?.playerName),
          isBot: Boolean(payload?.isBot),
        });
        break;
      }

      case "remove_player": {
        if (!state) throw new Error("State room tidak ditemukan.");
        nextState = removePlayerFromGame(state, String(payload?.playerId));
        break;
      }

      case "start_round": {
        if (!state) throw new Error("State room tidak ditemukan.");
        // Pengocokan CSPRNG dieksekusi di Server-Side (Node.js Web Crypto)
        nextState = startNewRound(state);
        break;
      }

      case "submit_threes": {
        if (!state) throw new Error("State room tidak ditemukan.");
        nextState = submitPlayerThrees(state, String(payload?.playerId));
        break;
      }

      case "play_cards": {
        if (!state) throw new Error("State room tidak ditemukan.");
        const cardIds = (payload?.cardIds as string[]) || [];
        nextState = playCards(state, String(payload?.playerId), cardIds);
        break;
      }

      case "pass_turn": {
        if (!state) throw new Error("State room tidak ditemukan.");
        nextState = passTurn(state, String(payload?.playerId));
        break;
      }

      case "send_taunt": {
        if (!state) throw new Error("State room tidak ditemukan.");
        nextState = sendTaunt(
          state,
          String(payload?.playerId),
          String(payload?.tauntId || "custom"),
          payload?.customText ? String(payload.customText) : undefined,
          payload?.customEmoji ? String(payload.customEmoji) : undefined
        );
        break;
      }

      case "forfeit_game": {
        if (!state) throw new Error("State room tidak ditemukan.");
        nextState = forfeitPlayer(state, String(payload?.playerId));
        break;
      }

      default:
        return NextResponse.json(
          { error: "Aksi tidak dikenali." },
          { status: 400 }
        );
    }

    return NextResponse.json({ state: nextState });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan pada server game.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

