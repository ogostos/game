"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { postJson } from "@/lib/client/http";
import { getOrCreateSessionId } from "@/lib/client/session";
import type { RoomAction, RoomPhase, RoomView } from "@/lib/shared/types";

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

function phaseLabel(phase: RoomPhase): string {
  switch (phase) {
    case "lobby":
      return "Лобби";
    case "discussion":
      return "Обсуждение";
    case "voting":
      return "Голосование";
    case "results":
      return "Результаты";
    default:
      return phase;
  }
}

function roleLabel(role: "truth" | "imposter" | null | undefined): string {
  if (role === "imposter") {
    return "Импостер";
  }

  return "Правда";
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
            throw new Error(payload.error ?? "Не удалось синхронизировать состояние комнаты.");
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
          setError(pollError instanceof Error ? pollError.message : "Потеряно соединение.");
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
      setError(actionError instanceof Error ? actionError.message : "Не удалось выполнить действие.");
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
      setError("Введите имя игрока.");
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
      setError(joinError instanceof Error ? joinError.message : "Не удалось войти в комнату.");
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
      setError("Не удалось скопировать ссылку.");
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
        <p className="eyebrow">Подключение</p>
        <h1 className="title-lg">Загрузка комнаты...</h1>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="panel stack-md">
        <h1 className="title-lg">Комната недоступна</h1>
        <p className="error-text">{error ?? "Не удалось загрузить комнату."}</p>
        <Link href="/" className="text-link">
          На главную
        </Link>
      </div>
    );
  }

  if (!state.joined) {
    return (
      <div className="panel stack-lg fade-up">
        <div className="stack-sm">
          <p className="eyebrow">Комната {state.roomCode}</p>
          <h1 className="title-lg">Вход в лобби</h1>
          <p className="muted">{state.message}</p>
        </div>

        <div className="pill-row">
          <span className="pill">Игроков: {state.players.length}</span>
          <span className="pill">Фаза: {phaseLabel(state.phase)}</span>
        </div>

        {state.phase === "lobby" ? (
          <form className="stack-md" onSubmit={handleJoinRoom}>
            <label className="input-label" htmlFor="join-display-name">
              Имя игрока
            </label>
            <input
              id="join-display-name"
              className="text-input"
              value={joinName}
              onChange={(event) => setJoinName(event.target.value)}
              placeholder="Ваше имя"
              maxLength={24}
              autoComplete="nickname"
            />

            <label className="input-label" htmlFor="join-room-password">
              Пароль (если есть)
            </label>
            <input
              id="join-room-password"
              className="text-input"
              value={joinPassword}
              onChange={(event) => setJoinPassword(event.target.value)}
              placeholder="Пароль комнаты"
              autoComplete="off"
            />

            <button className="button-primary" type="submit" disabled={workingAction === "join_room"}>
              {workingAction === "join_room" ? "Вход..." : "Войти"}
            </button>
          </form>
        ) : (
          <p className="muted">Сейчас идет раунд. Форма входа откроется, когда начнется лобби.</p>
        )}

        {error ? <p className="error-text">{error}</p> : null}

        <Link href="/" className="text-link">
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="stack-lg fade-up">
      <section className="panel stack-md">
        <div className="row-wrap space-between">
          <div className="stack-xs">
            <p className="eyebrow">Комната {state.roomCode}</p>
            <h1 className="title-lg">Правда или Фейк</h1>
          </div>
          <div className="pill-row">
            <span className="pill">Фаза: {phase ? phaseLabel(phase) : "—"}</span>
            <button className="button-ghost" type="button" onClick={copyRoomLink}>
              {copied ? "Ссылка скопирована" : "Копировать ссылку"}
            </button>
            <button className="button-ghost" type="button" onClick={() => sendAction({ type: "leave_room" })}>
              Выйти
            </button>
          </div>
        </div>

        {state.message ? <p className="muted">{state.message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="panel stack-md">
        <div className="row-wrap space-between">
          <h2 className="title-sm">Игроки</h2>
          <span className="muted">{state.players.length} в комнате</span>
        </div>
        <div className="player-grid">
          {state.players.map((player) => (
            <article key={player.id} className="player-card">
              <div className="row-wrap space-between">
                <p>{player.displayName}</p>
                <span className="muted">{player.score} очк.</span>
              </div>
              <div className="pill-row">
                {player.isHost ? <span className="pill">Хост</span> : null}
                {player.hasVoted ? <span className="pill">Проголосовал</span> : null}
                {player.id === state.meId ? <span className="pill">Вы</span> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {phase === "lobby" ? (
        <section className="panel stack-md slide-up">
          <h2 className="title-sm">Лобби</h2>

          {isHost ? (
            <>
              <div className="stack-sm">
                <label className="input-label" htmlFor="discussion-minutes">
                  Таймер обсуждения: {settingsDiscussionMinutes} мин
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
                  Количество импостеров
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
                  {workingAction === "update_settings" ? "Сохранение..." : "Сохранить настройки"}
                </button>

                <button
                  className="button-primary"
                  type="button"
                  onClick={() => sendAction({ type: "start_round" })}
                  disabled={!state.canStart || workingAction === "start_round"}
                >
                  {workingAction === "start_round" ? "Запуск..." : "Начать игру"}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Ожидайте, пока хост настроит параметры и запустит раунд.</p>
          )}
        </section>
      ) : null}

      {phase === "discussion" ? (
        <section className="panel stack-md slide-up">
          <div className="row-wrap space-between">
            <h2 className="title-sm">Обсуждение</h2>
            <p className="timer">{formatCountdown(discussionSecondsLeft)}</p>
          </div>

          <article className="card-panel">
            <p className="eyebrow">Ваша карточка</p>
            <h3 className={state.round?.myRole === "imposter" ? "role-badge imposter" : "role-badge truth"}>
              {roleLabel(state.round?.myRole)}
            </h3>
            <p>{state.round?.myCard}</p>
          </article>

          {isHost ? (
            <div className="button-row">
              <button
                className="button-secondary"
                type="button"
                onClick={() => sendAction({ type: "extend_discussion", seconds: 30 })}
                disabled={workingAction === "extend_discussion"}
              >
                {workingAction === "extend_discussion" ? "Продление..." : "+30 сек"}
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={() => sendAction({ type: "extend_discussion", seconds: 60 })}
                disabled={workingAction === "extend_discussion"}
              >
                {workingAction === "extend_discussion" ? "Продление..." : "+1 мин"}
              </button>
              <button
                className="button-primary"
                type="button"
                onClick={() => sendAction({ type: "end_discussion" })}
                disabled={workingAction === "end_discussion"}
              >
                {workingAction === "end_discussion" ? "Завершение..." : "Завершить обсуждение"}
              </button>
            </div>
          ) : (
            <p className="muted">Обсудите факты в группе. После таймера начнется голосование.</p>
          )}
        </section>
      ) : null}

      {phase === "voting" ? (
        <section className="panel stack-md slide-up">
          <h2 className="title-sm">Голосование: кто получил фейковый факт?</h2>

          <article className="card-panel">
            <p className="eyebrow">Ваша карточка</p>
            <h3 className={state.round?.myRole === "imposter" ? "role-badge imposter" : "role-badge truth"}>
              {roleLabel(state.round?.myRole)}
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
            {state.round?.myVote ? <p className="muted">Ваш голос: {playersById[state.round.myVote]}.</p> : <p />}

            {isHost ? (
              <button
                className="button-secondary"
                type="button"
                onClick={() => sendAction({ type: "reveal_results" })}
                disabled={workingAction === "reveal_results"}
              >
                {workingAction === "reveal_results" ? "Открытие..." : "Открыть результаты"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {phase === "results" ? (
        <section className="panel stack-md slide-up">
          <h2 className="title-sm">Результаты</h2>

          <article className="card-panel">
            <p className="eyebrow">Импостеры</p>
            <p>
              {(state.round?.imposters ?? [])
                .map((playerId) => playersById[playerId] ?? "Неизвестно")
                .join(", ") || "Нет"}
            </p>
          </article>

          <div className="stack-sm">
            <h3 className="title-xs">Голоса</h3>
            {state.round?.votes && Object.keys(state.round.votes).length > 0 ? (
              <div className="stack-xs">
                {Object.entries(state.round.votes).map(([voterId, targetId]) => (
                  <p key={voterId} className="muted">
                    {playersById[voterId] ?? "Неизвестно"} голосует за {playersById[targetId] ?? "Неизвестно"}
                  </p>
                ))}
              </div>
            ) : (
              <p className="muted">Голоса отсутствуют.</p>
            )}
          </div>

          <div className="stack-sm">
            <h3 className="title-xs">Выданные карточки</h3>
            {state.round?.cards ? (
              <div className="stack-xs">
                {Object.entries(state.round.cards).map(([playerId, cardInfo]) => (
                  <p key={playerId} className="muted">
                    <strong>{playersById[playerId] ?? "Неизвестно"}:</strong> {cardInfo.card} ({roleLabel(cardInfo.role)})
                  </p>
                ))}
              </div>
            ) : (
              <p className="muted">Карточки недоступны.</p>
            )}
          </div>

          <div className="stack-sm">
            <h3 className="title-xs">Факты раунда ({state.round?.facts?.length ?? 0})</h3>
            {state.round?.facts?.length ? (
              <div className="stack-xs">
                {state.round.facts.map((fact) => (
                  <p key={fact.id} className="muted">
                    <strong>{fact.category}:</strong> Правда — {fact.realFact} | Фейк — {fact.fakeFact}
                  </p>
                ))}
              </div>
            ) : (
              <p className="muted">Список фактов недоступен.</p>
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
                {workingAction === "play_again" ? "Запуск..." : "Следующий раунд"}
              </button>

              <button
                className="button-secondary"
                type="button"
                onClick={() => sendAction({ type: "back_to_lobby" })}
                disabled={workingAction === "back_to_lobby"}
              >
                {workingAction === "back_to_lobby" ? "Возврат..." : "Вернуться в лобби"}
              </button>
            </div>
          ) : (
            <p className="muted">Ожидайте решения хоста: новый раунд или возврат в лобби.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
