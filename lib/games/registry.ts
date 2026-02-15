import type { GameId, GameSummary } from "@/lib/shared/types";

const GAMES: GameSummary[] = [
  {
    id: "fact-or-fake",
    title: "Fact or Fake",
    description: "Find the player with fake information before votes are locked.",
    minPlayers: 3,
    maxImposters: 3,
    factCount: 10068
  }
];

export function listGames(): GameSummary[] {
  return GAMES;
}

export function getGame(gameId: GameId): GameSummary | undefined {
  return GAMES.find((game) => game.id === gameId);
}
