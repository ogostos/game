import { getFactOrFakeDeck } from "@/lib/games/fact-or-fake/facts";
import type { FactDeck, GameId, Language } from "@/lib/shared/types";

export function getFactsForGame(gameId: GameId, language: Language): FactDeck {
  if (gameId === "fact-or-fake" || gameId === "true-or-false") {
    return getFactOrFakeDeck(language);
  }

  return {
    realFacts: [],
    fakeFacts: []
  };
}
