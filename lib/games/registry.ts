import {
  FACT_OR_FAKE_FAKE_FACT_COUNT,
  FACT_OR_FAKE_REAL_FACT_COUNT
} from "@/lib/games/fact-or-fake/facts";
import type { GameId, GameSummary } from "@/lib/shared/types";

const GAMES: GameSummary[] = [
  {
    id: "fact-or-fake",
    title: "Fact or Fake",
    description: "Find the player with fake information before votes are locked.",
    minPlayers: 3,
    maxImposters: 3,
    supportsImposters: true,
    factCount: FACT_OR_FAKE_REAL_FACT_COUNT
  },
  {
    id: "true-or-false",
    title: "True or False",
    description: "A statement appears for everyone. Decide if it is true or false.",
    minPlayers: 1,
    maxImposters: 0,
    supportsImposters: false,
    factCount: FACT_OR_FAKE_REAL_FACT_COUNT + FACT_OR_FAKE_FAKE_FACT_COUNT
  }
];

export function listGames(): GameSummary[] {
  return GAMES;
}

export function getGame(gameId: GameId): GameSummary | undefined {
  return GAMES.find((game) => game.id === gameId);
}
