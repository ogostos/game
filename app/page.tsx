"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LanguageToggle } from "@/components/language-toggle";
import { getStoredLanguage, setStoredLanguage } from "@/lib/client/language";
import { listGames } from "@/lib/games/registry";
import { gameText } from "@/lib/shared/i18n/language";
import type { Language } from "@/lib/shared/types";

const COPY = {
  en: {
    eyebrow: "Party Game Box",
    title: "Play quick social games in your browser.",
    subtitle:
      "Create a room, share a link, and start rounds instantly. Designed mobile-first for group play.",
    availableGames: "Available Games",
    moreSoon: "More modes coming soon",
    live: "Live",
    minPlayers: "Min",
    players: "players",
    upTo: "Up to",
    imposters: "imposters",
    solo: "Solo",
    facts: "Facts",
    comingSoon: "Soon",
    newSlot: "New Game Slot",
    newSlotText: "This slot is intentionally reserved for future game modes."
  },
  ru: {
    eyebrow: "Игровая коробка",
    title: "Быстрые социальные игры прямо в браузере.",
    subtitle:
      "Создайте комнату, поделитесь ссылкой и сразу начинайте раунды. Интерфейс оптимизирован под мобильные устройства.",
    availableGames: "Доступные игры",
    moreSoon: "Скоро появятся новые режимы",
    live: "Онлайн",
    minPlayers: "От",
    players: "игроков",
    upTo: "До",
    imposters: "импостеров",
    solo: "Соло",
    facts: "Фактов",
    comingSoon: "Скоро",
    newSlot: "Слот для новой игры",
    newSlotText: "Этот блок зарезервирован под следующие игровые режимы."
  }
} as const;

export default function HomePage() {
  const games = listGames();
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    setLanguage(getStoredLanguage());
  }, []);

  function updateLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setStoredLanguage(nextLanguage);
  }

  const copy = COPY[language];

  function cardToken(gameId: string) {
    if (gameId === "fact-or-fake") {
      return "F/F";
    }

    if (gameId === "true-or-false") {
      return "T/F";
    }

    return "NEW";
  }

  return (
    <main className="shell stack-xl home-shell">
      <section className="hero-panel fade-up stack-md party-hero">
        <div className="row-wrap space-between">
          <p className="eyebrow">{copy.eyebrow}</p>
          <LanguageToggle language={language} onChange={updateLanguage} />
        </div>
        <h1 className="title-xl">{copy.title}</h1>
        <p className="hero-copy">{copy.subtitle}</p>
      </section>

      <section className="stack-md">
        <div className="row-wrap space-between">
          <h2 className="title-md">{copy.availableGames}</h2>
          <p className="muted">{copy.moreSoon}</p>
        </div>

        <div className="game-grid">
          {games.map((game) => {
            const gameCopy = gameText(game.id, language);
            const toneClass = game.id === "fact-or-fake" ? "tone-coral" : "tone-teal";

            return (
              <Link key={game.id} href={`/games/${game.id}`} className={`game-card ${toneClass}`}>
                <div className="row-wrap space-between">
                  <p className="eyebrow">{copy.live}</p>
                  <span className="game-token">{cardToken(game.id)}</span>
                </div>
                <h3 className="title-sm">{gameCopy.title}</h3>
                <p className="muted">{gameCopy.description}</p>
                <div className="pill-row">
                  <span className="pill">
                    {copy.minPlayers} {game.minPlayers} {copy.players}
                  </span>
                  <span className="pill">
                    {game.supportsImposters ? `${copy.upTo} ${game.maxImposters} ${copy.imposters}` : copy.solo}
                  </span>
                  <span className="pill">
                    {copy.facts}: {game.factCount}
                  </span>
                </div>
              </Link>
            );
          })}

          <article className="game-card pending tone-sky">
            <p className="eyebrow">{copy.comingSoon}</p>
            <h3 className="title-sm">{copy.newSlot}</h3>
            <p className="muted">{copy.newSlotText}</p>
          </article>
        </div>
      </section>
    </main>
  );
}
