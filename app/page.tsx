import Link from "next/link";

import { listGames } from "@/lib/games/registry";

export default function HomePage() {
  const games = listGames();

  return (
    <main className="shell stack-xl">
      <section className="hero-panel fade-up">
        <p className="eyebrow">Игровая коробка</p>
        <h1 className="title-xl">Быстрые социальные игры прямо в браузере.</h1>
        <p className="hero-copy">
          Создайте комнату, поделитесь ссылкой и сразу начинайте раунд. Интерфейс оптимизирован под мобильные устройства.
        </p>
      </section>

      <section className="stack-md">
        <div className="row-wrap space-between">
          <h2 className="title-md">Доступные игры</h2>
          <p className="muted">Скоро появятся новые режимы</p>
        </div>

        <div className="game-grid">
          {games.map((game) => (
            <Link key={game.id} href={`/games/${game.id}`} className="game-card">
              <p className="eyebrow">Онлайн</p>
              <h3 className="title-sm">{game.title}</h3>
              <p className="muted">{game.description}</p>
              <div className="pill-row">
                <span className="pill">От {game.minPlayers} игроков</span>
                <span className="pill">До {game.maxImposters} импостеров</span>
                <span className="pill">Фактов: {game.factCount}</span>
              </div>
            </Link>
          ))}

          <article className="game-card pending">
            <p className="eyebrow">Скоро</p>
            <h3 className="title-sm">Слот для новой игры</h3>
            <p className="muted">Этот блок зарезервирован под следующие игровые режимы.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
