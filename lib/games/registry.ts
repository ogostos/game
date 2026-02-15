import { FACT_OR_FAKE_FACTS } from "@/lib/games/fact-or-fake/facts";
import type { GameId, GameSummary } from "@/lib/shared/types";

const GAMES: GameSummary[] = [
  {
    id: "fact-or-fake",
    title: "Правда или Фейк",
    description: "Найдите игрока с поддельным фактом до завершения голосования.",
    minPlayers: 3,
    maxImposters: 3,
    factCount: FACT_OR_FAKE_FACTS.length
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
