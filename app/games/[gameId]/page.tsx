import { notFound } from "next/navigation";

import { GameEntryClient } from "@/components/game-entry-client";
import { listGames } from "@/lib/games/registry";

interface GamePageProps {
  params: Promise<{ gameId: string }>;
}

export default async function GamePage({ params }: GamePageProps) {
  const { gameId } = await params;
  const game = listGames().find((entry) => entry.id === gameId);

  if (!game) {
    notFound();
  }

  return (
    <main className="shell stack-xl">
      <GameEntryClient game={game} />
    </main>
  );
}
