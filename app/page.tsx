import Link from "next/link";

import { listGames } from "@/lib/games/registry";

export default function HomePage() {
  const games = listGames();

  return (
    <main className="shell stack-xl">
      <section className="hero-panel fade-up">
        <p className="eyebrow">Party Game Box</p>
        <h1 className="title-xl">Play quick social games in your browser.</h1>
        <p className="hero-copy">
          Start a room, share a code, and jump straight into live rounds. Mobile-first and built for fast group play.
        </p>
      </section>

      <section className="stack-md">
        <div className="row-wrap space-between">
          <h2 className="title-md">Available Games</h2>
          <p className="muted">More modes coming soon</p>
        </div>

        <div className="game-grid">
          {games.map((game) => (
            <Link key={game.id} href={`/games/${game.id}`} className="game-card">
              <p className="eyebrow">Live</p>
              <h3 className="title-sm">{game.title}</h3>
              <p className="muted">{game.description}</p>
              <div className="pill-row">
                <span className="pill">Min {game.minPlayers} players</span>
                <span className="pill">Up to {game.maxImposters} imposters</span>
              </div>
            </Link>
          ))}

          <article className="game-card pending">
            <p className="eyebrow">Soon</p>
            <h3 className="title-sm">New Game Slot</h3>
            <p className="muted">This slot is intentionally reserved for future game modes.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
