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
  timeoutTurn,
  togglePlayerReady,
  updatePlayerProfile,
  updateRoomSettings,
} from "@/lib/game/engine";
import { GameState } from "@/lib/game/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, state, payload } = body as {
      action:
        | "create_room"
        | "create_bot_game"
        | "join_room"
        | "remove_player"
        | "start_round"
        | "submit_threes"
        | "play_cards"
        | "pass_turn"
        | "timeout_turn"
        | "send_taunt"
        | "forfeit_game"
        | "update_room_settings"
        | "toggle_ready"
        | "update_player_profile";
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

      case "create_bot_game": {
        const roomCode = String(payload?.roomCode || "POKR01");
        const hostId = String(payload?.hostId || "host-1");
        const hostName = String(payload?.hostName || "Pemain 1");
        const totalPlayers = Math.min(
          4,
          Math.max(2, Number(payload?.totalPlayers || 4))
        );
        const turnDurationLimit =
          payload?.turnDurationLimit !== undefined
            ? Number(payload.turnDurationLimit)
            : 20;

        let tempState = createInitialGameState({ roomCode, hostId, hostName });
        tempState = {
          ...tempState,
          players: tempState.players.map((p) =>
            p.id === hostId ? { ...p, isReady: true } : p
          ),
        };
        tempState = updateRoomSettings(tempState, { turnDurationLimit });

        const botNames = ["Bot Himiya", "Bot Riko", "Bot Sari"];
        for (let i = 0; i < totalPlayers - 1; i++) {
          tempState = addPlayerToGame(tempState, {
            id: `bot-${i + 1}-${Date.now()}-${i}`,
            name: botNames[i],
            isBot: true,
          });
        }
        nextState = startNewRound(tempState);
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
        const requesterId = payload?.playerId
          ? String(payload.playerId)
          : undefined;
        nextState = startNewRound(state, requesterId);
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

      case "timeout_turn": {
        if (!state) throw new Error("State room tidak ditemukan.");
        nextState = timeoutTurn(state, String(payload?.playerId));
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

      case "update_room_settings": {
        if (!state) throw new Error("State room tidak ditemukan.");
        nextState = updateRoomSettings(state, {
          turnDurationLimit:
            payload?.turnDurationLimit !== undefined
              ? Number(payload.turnDurationLimit)
              : undefined,
        });
        break;
      }

      case "toggle_ready": {
        if (!state) throw new Error("State room tidak ditemukan.");
        nextState = togglePlayerReady(state, String(payload?.playerId));
        break;
      }

      case "update_player_profile": {
        if (!state) throw new Error("State room tidak ditemukan.");
        nextState = updatePlayerProfile(state, String(payload?.playerId), {
          name: payload?.name !== undefined ? String(payload.name) : undefined,
          seatIndex:
            payload?.seatIndex !== undefined
              ? Number(payload.seatIndex)
              : undefined,
        });
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

