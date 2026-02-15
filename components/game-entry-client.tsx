"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { postJson } from "@/lib/client/http";
import { getOrCreateSessionId } from "@/lib/client/session";
import type { GameSummary, RoomView } from "@/lib/shared/types";

interface GameEntryClientProps {
  game: GameSummary;
}

export function GameEntryClient({ game }: GameEntryClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!createName.trim()) {
      setError("Display name is required.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const sessionId = getOrCreateSessionId();
      const response = await postJson<{ state: RoomView }>("/api/rooms/create", {
        sessionId,
        displayName: createName,
        gameId: game.id,
        password: createPassword
      });

      router.push(`/room/${response.state.roomCode}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create room.");
    } finally {
      setPending(false);
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!joinCode.trim()) {
      setError("Room code is required.");
      return;
    }

    if (!joinName.trim()) {
      setError("Display name is required.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const sessionId = getOrCreateSessionId();
      const response = await postJson<{ state: RoomView }>("/api/rooms/join", {
        sessionId,
        roomCode: joinCode,
        displayName: joinName,
        password: joinPassword
      });

      router.push(`/room/${response.state.roomCode}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not join room.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="panel stack-lg">
      <div className="stack-sm">
        <p className="eyebrow">Game Mode</p>
        <h1 className="title-lg">{game.title}</h1>
        <p className="muted">{game.description}</p>
      </div>

      <div className="segmented-control" role="tablist" aria-label="Room entry mode">
        <button
          type="button"
          className={mode === "create" ? "segmented-active" : "segmented-button"}
          onClick={() => setMode("create")}
        >
          Create Room
        </button>
        <button
          type="button"
          className={mode === "join" ? "segmented-active" : "segmented-button"}
          onClick={() => setMode("join")}
        >
          Join Room
        </button>
      </div>

      {mode === "create" ? (
        <form className="stack-md" onSubmit={handleCreate}>
          <label className="input-label" htmlFor="create-name">
            Display name
          </label>
          <input
            id="create-name"
            className="text-input"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="Your name"
            maxLength={24}
            autoComplete="nickname"
          />

          <label className="input-label" htmlFor="create-password">
            Password (optional)
          </label>
          <input
            id="create-password"
            className="text-input"
            value={createPassword}
            onChange={(event) => setCreatePassword(event.target.value)}
            placeholder="Leave empty for open room"
            autoComplete="off"
          />

          <button className="button-primary" type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create Room"}
          </button>
        </form>
      ) : (
        <form className="stack-md" onSubmit={handleJoin}>
          <label className="input-label" htmlFor="join-room-code">
            Room code
          </label>
          <input
            id="join-room-code"
            className="text-input"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="ABCDE"
            maxLength={5}
            autoCapitalize="characters"
            autoComplete="off"
          />

          <label className="input-label" htmlFor="join-name">
            Display name
          </label>
          <input
            id="join-name"
            className="text-input"
            value={joinName}
            onChange={(event) => setJoinName(event.target.value)}
            placeholder="Your name"
            maxLength={24}
            autoComplete="nickname"
          />

          <label className="input-label" htmlFor="join-password">
            Password (if required)
          </label>
          <input
            id="join-password"
            className="text-input"
            value={joinPassword}
            onChange={(event) => setJoinPassword(event.target.value)}
            placeholder="Room password"
            autoComplete="off"
          />

          <button className="button-primary" type="submit" disabled={pending}>
            {pending ? "Joining..." : "Join Room"}
          </button>
        </form>
      )}

      {error ? <p className="error-text">{error}</p> : null}

      <div className="stack-sm">
        <p className="muted">Min players: {game.minPlayers}</p>
        <Link href="/" className="text-link">
          Back to Game Box
        </Link>
      </div>
    </div>
  );
}
