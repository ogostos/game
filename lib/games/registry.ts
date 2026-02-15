import { FACT_OR_FAKE_FACTS } from "@/lib/games/fact-or-fake/facts";
import type { GameId, GameSummary } from "@/lib/shared/types";

const GAMES: GameSummary[] = [
  {
    id: "fact-or-fake",
    title: "Fact or Fake",
    description: "Spot the player holding the fake fact before the votes lock in.",
    minPlayers: 3,
    maxImposters: 3
  }
];

export function listGames(): GameSummary[] {
  return GAMES;
}

export function getGame(gameId: GameId): GameSummary | undefined {
  return GAMES.find((game) => game.id === gameId);
}

export function getFactsForGame(gameId: GameId) {
  if (gameId === "fact-or-fake") {
    return FACT_OR_FAKE_FACTS;
  }

  return [];
}
