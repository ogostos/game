"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { postJson } from "@/lib/client/http";
import { getOrCreateSessionId } from "@/lib/client/session";
import type { RoomAction, RoomView } from "@/lib/shared/types";

interface RoomClientProps {
  roomCode: string;
}

const POLL_ERROR_RETRY_MS = 1200;

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function RoomClient({ roomCode }: RoomClientProps) {
  const router = useRouter();
  const normalizedRoomCode = roomCode.toUpperCase();
  const [sessionId, setSessionId] = useState("");
  const [state, setState] = useState<RoomView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [settingsDiscussionMinutes, setSettingsDiscussionMinutes] = useState(2);
  const [settingsImposters, setSettingsImposters] = useState(1);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const versionRef = useRef(0);
  const syncedDiscussionMinutes = state?.settings.discussionMinutes;
  const syncedImposters = state?.settings.imposters;

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (syncedDiscussionMinutes === undefined || syncedImposters === undefined) {
      return;
    }

    setSettingsDiscussionMinutes(syncedDiscussionMinutes);
    setSettingsImposters(syncedImposters);
  }, [syncedDiscussionMinutes, syncedImposters]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    async function pollRoom() {
      while (!cancelled) {
        try {
          const response = await fetch(
            `/api/rooms/${normalizedRoomCode}/sync?sessionId=${encodeURIComponent(sessionId)}&since=${versionRef.current}`,
            { cache: "no-store" }
          );
          const payload = (await response.json()) as { error?: string; state?: RoomView };

          if (!response.ok || !payload.state) {
            throw new Error(payload.error ?? "Unable to sync room state.");
          }

          if (cancelled) {
            return;
          }

          versionRef.current = payload.state.version;
          setState(payload.state);
          setLoading(false);
          setError(null);
        } catch (pollError) {
          if (cancelled) {
            return;
          }

          setLoading(false);
          setError(pollError instanceof Error ? pollError.message : "Connection lost.");
          await delay(POLL_ERROR_RETRY_MS);
        }
      }
    }

    void pollRoom();

    return () => {
      cancelled = true;
    };
  }, [normalizedRoomCode, sessionId]);

  async function sendAction(action: RoomAction) {
    if (!sessionId) {
      return;
    }

    setWorkingAction(action.type);
    setError(null);

    try {
      const response = await postJson<{ state: RoomView }>(`/api/rooms/${normalizedRoomCode}/action`, {
        sessionId,
        action
      });

      versionRef.current = response.state.version;
      setState(response.state);

      if (action.type === "leave_room") {
        router.push("/");
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    } finally {
      setWorkingAction(null);
    }
  }

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionId) {
      return;
    }

    if (!joinName.trim()) {
      setError("Display name is required.");
      return;
    }

    setWorkingAction("join_room");
    setError(null);

    try {
      const response = await postJson<{ state: RoomView }>("/api/rooms/join", {
        sessionId,
        roomCode: normalizedRoomCode,
        displayName: joinName,
        password: joinPassword
      });

      versionRef.current = response.state.version;
      setState(response.state);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join room.");
    } finally {
      setWorkingAction(null);
    }
  }

  async function copyRoomLink() {
    try {
      const shareUrl = `${window.location.origin}/room/${normalizedRoomCode}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy room link.");
    }
  }

  const isHost = Boolean(state?.joined && state.hostId && state.meId && state.hostId === state.meId);
  const phase = state?.phase;
  const maxImposters = state ? Math.max(1, Math.min(3, state.players.length - 2)) : 1;
  const discussionSecondsLeft =
    state?.phase === "discussion" && state.round?.discussionEndsAt
      ? Math.max(0, Math.ceil((state.round.discussionEndsAt - now) / 1000))
      : 0;

  const playersById = useMemo(() => {
    if (!state) {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(state.players.map((player) => [player.id, player.displayName]));
  }, [state]);

  if (!sessionId || (loading && !state)) {
    return (
      <div className="panel stack-md">
        <p className="eyebrow">Connecting</p>
        <h1 className="title-lg">Loading room...</h1>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="panel stack-md">
        <h1 className="title-lg">Room unavailable</h1>
        <p className="error-text">{error ?? "Could not load this room."}</p>
        <Link href="/" className="text-link">
          Back to home
        </Link>
      </div>
    );
  }

  if (!state.joined) {
    return (
      <div className="panel stack-lg fade-up">
        <div className="stack-sm">
          <p className="eyebrow">Room {state.roomCode}</p>
          <h1 className="title-lg">Join lobby</h1>
          <p className="muted">{state.message}</p>
        </div>

        <div className="pill-row">
          <span className="pill">Players: {state.players.length}</span>
          <span className="pill">Phase: {state.phase}</span>
        </div>

        {state.phase === "lobby" ? (
          <form className="stack-md" onSubmit={handleJoinRoom}>
            <label className="input-label" htmlFor="join-display-name">
              Display name
            </label>
            <input
              id="join-display-name"
              className="text-input"
              value={joinName}
              onChange={(event) => setJoinName(event.target.value)}
              placeholder="Your name"
              maxLength={24}
              autoComplete="nickname"
            />

            <label className="input-label" htmlFor="join-room-password">
              Password (if required)
            </label>
            <input
              id="join-room-password"
              className="text-input"
              value={joinPassword}
              onChange={(event) => setJoinPassword(event.target.value)}
              placeholder="Room password"
              autoComplete="off"
            />

            <button className="button-primary" type="submit" disabled={workingAction === "join_room"}>
              {workingAction === "join_room" ? "Joining..." : "Join Room"}
            </button>
          </form>
        ) : (
          <p className="muted">A round is running right now. The join form will unlock when the lobby reopens.</p>
        )}

        {error ? <p className="error-text">{error}</p> : null}

        <Link href="/" className="text-link">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="stack-lg fade-up">
      <section className="panel stack-md">
        <div className="row-wrap space-between">
          <div className="stack-xs">
            <p className="eyebrow">Room {state.roomCode}</p>
            <h1 className="title-lg">Fact or Fake</h1>
          </div>
          <div className="pill-row">
            <span className="pill">Phase: {phase}</span>
            <button className="button-ghost" type="button" onClick={copyRoomLink}>
              {copied ? "Link copied" : "Copy link"}
            </button>
            <button className="button-ghost" type="button" onClick={() => sendAction({ type: "leave_room" })}>
              Leave
            </button>
          </div>
        </div>

        {state.message ? <p className="muted">{state.message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="panel stack-md">
        <div className="row-wrap space-between">
          <h2 className="title-sm">Players</h2>
          <span className="muted">{state.players.length} in room</span>
        </div>
        <div className="player-grid">
          {state.players.map((player) => (
            <article key={player.id} className="player-card">
              <div className="row-wrap space-between">
                <p>{player.displayName}</p>
                <span className="muted">{player.score} pts</span>
              </div>
              <div className="pill-row">
                {player.isHost ? <span className="pill">Host</span> : null}
                {player.hasVoted ? <span className="pill">Voted</span> : null}
                {player.id === state.meId ? <span className="pill">You</span> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {phase === "lobby" ? (
        <section className="panel stack-md slide-up">
          <h2 className="title-sm">Lobby</h2>

          {isHost ? (
            <>
              <div className="stack-sm">
                <label className="input-label" htmlFor="discussion-minutes">
                  Discussion timer: {settingsDiscussionMinutes} min
                </label>
                <input
                  id="discussion-minutes"
                  type="range"
                  min={1}
                  max={5}
                  value={settingsDiscussionMinutes}
                  onChange={(event) => setSettingsDiscussionMinutes(Number(event.target.value))}
                />
              </div>

              <div className="stack-sm">
                <label className="input-label" htmlFor="imposter-count">
                  Number of imposters
                </label>
                <select
                  id="imposter-count"
                  className="text-input"
                  value={settingsImposters}
                  onChange={(event) => setSettingsImposters(Number(event.target.value))}
                >
                  {Array.from({ length: maxImposters }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </div>

              <div className="button-row">
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() =>
                    sendAction({
                      type: "update_settings",
                      discussionMinutes: settingsDiscussionMinutes,
                      imposters: settingsImposters
                    })
                  }
                  disabled={workingAction === "update_settings"}
                >
                  {workingAction === "update_settings" ? "Saving..." : "Save settings"}
                </button>

                <button
                  className="button-primary"
                  type="button"
                  onClick={() => sendAction({ type: "start_round" })}
                  disabled={!state.canStart || workingAction === "start_round"}
                >
                  {workingAction === "start_round" ? "Starting..." : "Start Game"}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Waiting for host to adjust settings and start the round.</p>
          )}
        </section>
      ) : null}

      {phase === "discussion" ? (
        <section className="panel stack-md slide-up">
          <div className="row-wrap space-between">
            <h2 className="title-sm">Discussion</h2>
            <p className="timer">{formatCountdown(discussionSecondsLeft)}</p>
          </div>

          <article className="card-panel">
            <p className="eyebrow">Your Card</p>
            <h3 className={state.round?.myRole === "imposter" ? "role-badge imposter" : "role-badge truth"}>
              {state.round?.myRole === "imposter" ? "Imposter" : "Truth"}
            </h3>
            <p>{state.round?.myCard}</p>
          </article>

          <p className="muted">
            Discuss with the group. When the timer hits zero, voting starts automatically.
          </p>
        </section>
      ) : null}

      {phase === "voting" ? (
        <section className="panel stack-md slide-up">
          <h2 className="title-sm">Vote: Who has the fake fact?</h2>

          <article className="card-panel">
            <p className="eyebrow">Your Card</p>
            <h3 className={state.round?.myRole === "imposter" ? "role-badge imposter" : "role-badge truth"}>
              {state.round?.myRole === "imposter" ? "Imposter" : "Truth"}
            </h3>
            <p>{state.round?.myCard}</p>
          </article>

          <div className="vote-grid">
            {state.players
              .filter((player) => player.id !== state.meId)
              .map((player) => (
                <button
                  key={player.id}
                  className={state.round?.myVote === player.id ? "vote-option active" : "vote-option"}
                  type="button"
                  onClick={() => sendAction({ type: "cast_vote", targetPlayerId: player.id })}
                  disabled={workingAction === "cast_vote"}
                >
                  {player.displayName}
                </button>
              ))}
          </div>

          <div className="row-wrap space-between">
            {state.round?.myVote ? <p className="muted">You voted for {playersById[state.round.myVote]}.</p> : <p />}

            {isHost ? (
              <button
                className="button-secondary"
                type="button"
                onClick={() => sendAction({ type: "reveal_results" })}
                disabled={workingAction === "reveal_results"}
              >
                {workingAction === "reveal_results" ? "Revealing..." : "Reveal early"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {phase === "results" ? (
        <section className="panel stack-md slide-up">
          <h2 className="title-sm">Results</h2>

          <div className="result-grid">
            <article className="card-panel">
              <p className="eyebrow">Real Fact</p>
              <p>{state.round?.realFact}</p>
            </article>
            <article className="card-panel">
              <p className="eyebrow">Fake Fact</p>
              <p>{state.round?.fakeFact}</p>
            </article>
          </div>

          <article className="card-panel">
            <p className="eyebrow">Imposters</p>
            <p>
              {(state.round?.imposters ?? [])
                .map((playerId) => playersById[playerId] ?? "Unknown")
                .join(", ") || "None"}
            </p>
          </article>

          <div className="stack-sm">
            <h3 className="title-xs">Votes</h3>
            {(state.round?.votes && Object.keys(state.round.votes).length > 0) ? (
              <div className="stack-xs">
                {Object.entries(state.round.votes).map(([voterId, targetId]) => (
                  <p key={voterId} className="muted">
                    {playersById[voterId] ?? "Unknown"} voted for {playersById[targetId] ?? "Unknown"}
                  </p>
                ))}
              </div>
            ) : (
              <p className="muted">No votes recorded.</p>
            )}
          </div>

          <div className="stack-sm">
            <h3 className="title-xs">Assigned Cards</h3>
            {state.round?.cards ? (
              <div className="stack-xs">
                {Object.entries(state.round.cards).map(([playerId, cardInfo]) => (
                  <p key={playerId} className="muted">
                    <strong>{playersById[playerId] ?? "Unknown"}:</strong> {cardInfo.card} ({cardInfo.role})
                  </p>
                ))}
              </div>
            ) : (
              <p className="muted">Cards unavailable.</p>
            )}
          </div>

          {isHost ? (
            <div className="button-row">
              <button
                className="button-primary"
                type="button"
                onClick={() => sendAction({ type: "play_again" })}
                disabled={workingAction === "play_again"}
              >
                {workingAction === "play_again" ? "Starting..." : "Play again"}
              </button>

              <button
                className="button-secondary"
                type="button"
                onClick={() => sendAction({ type: "back_to_lobby" })}
                disabled={workingAction === "back_to_lobby"}
              >
                {workingAction === "back_to_lobby" ? "Returning..." : "Back to lobby"}
              </button>
            </div>
          ) : (
            <p className="muted">Waiting for host to start the next round or return to lobby.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
