import type { GameId, Language } from "@/lib/shared/types";

export const SUPPORTED_LANGUAGES: Language[] = ["en", "ru"];

export function normalizeLanguage(value: string | undefined | null): Language {
  return value === "ru" ? "ru" : "en";
}

const GAME_TEXT: Record<
  GameId,
  {
    en: { title: string; description: string };
    ru: { title: string; description: string };
  }
> = {
  "fact-or-fake": {
    en: {
      title: "Fact or Fake",
      description: "Find the player with fake information before votes are locked."
    },
    ru: {
      title: "Правда или Фейк",
      description: "Найдите игрока с фейком до завершения голосования."
    }
  }
};

export function gameText(gameId: GameId, language: Language) {
  return GAME_TEXT[gameId][language];
}

const PHASE_TEXT: Record<
  Language,
  {
    lobby: string;
    discussion: string;
    voting: string;
    results: string;
  }
> = {
  en: {
    lobby: "Lobby",
    discussion: "Discussion",
    voting: "Voting",
    results: "Results"
  },
  ru: {
    lobby: "Лобби",
    discussion: "Обсуждение",
    voting: "Голосование",
    results: "Результаты"
  }
};

export function phaseText(language: Language, phase: "lobby" | "discussion" | "voting" | "results") {
  return PHASE_TEXT[language][phase];
}
