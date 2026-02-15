"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { LanguageToggle } from "@/components/language-toggle";
import { getStoredLanguage, setStoredLanguage } from "@/lib/client/language";
import { postJson } from "@/lib/client/http";
import { getOrCreateSessionId } from "@/lib/client/session";
import { gameText, phaseText } from "@/lib/shared/i18n/language";
import type { Language, RoomAction, RoomView } from "@/lib/shared/types";

interface RoomClientProps {
  roomCode: string;
}

const POLL_ERROR_RETRY_MS = 1200;

const COPY = {
  en: {
    connecting: "Connecting",
    loadingRoom: "Loading room...",
    roomUnavailable: "Room unavailable",
    cannotLoadRoom: "Could not load this room.",
    backHome: "Back to home",
    room: "Room",
    joinLobby: "Join lobby",
    players: "Players",
    phase: "Phase",
    enterNameToJoin: "Enter your name to join this room.",
    roundInProgressJoinLater: "A round is running now. Join form unlocks when lobby returns.",
    displayName: "Display name",
    yourName: "Your name",
    passwordIfRequired: "Password (if required)",
    roomPassword: "Room password",
    joining: "Joining...",
    joinRoom: "Join Room",
    copyLink: "Copy link",
    linkCopied: "Link copied",
    leave: "Leave",
    inRoom: "in room",
    host: "Host",
    voted: "Voted",
    you: "You",
    lobby: "Lobby",
    discussionTimer: "Discussion timer",
    minutesShort: "min",
    imposterCount: "Number of imposters",
    saveSettings: "Save settings",
    saving: "Saving...",
    startGame: "Start Game",
    starting: "Starting...",
    roomFactLanguage: "Fact language in room",
    english: "English",
    russian: "Russian",
    waitingHostStart: "Waiting for host to adjust settings and start the round.",
    discussion: "Discussion",
    yourCard: "Your Card",
    extend30: "+30 sec",
    extend60: "+1 min",
    extending: "Extending...",
    endDiscussion: "End discussion",
    endingDiscussion: "Ending...",
    discussionHint: "Discuss as a group. Voting starts automatically when timer reaches zero.",
    votingTitle: "Vote: who has the fake fact?",
    yourVotePrefix: "You voted for",
    revealEarly: "Reveal early",
    revealing: "Revealing...",
    results: "Results",
    imposters: "Imposters",
    none: "None",
    votes: "Votes",
    noVotes: "No votes recorded.",
    dealtCards: "Assigned Cards",
    cardsUnavailable: "Cards unavailable.",
    roundFacts: "Round facts",
    realFacts: "Real facts",
    fakeFacts: "Fake facts",
    factsUnavailable: "Facts unavailable.",
    truth: "Truth",
    fake: "Fake",
    roleImposter: "Imposter",
    roleTruth: "Truth",
    unknown: "Unknown",
    playAgain: "Next round",
    backToLobby: "Back to lobby",
    returning: "Returning...",
    waitingHostDecision: "Waiting for host to start the next round or return to lobby.",
    enterNameError: "Display name is required.",
    syncFailed: "Unable to sync room state.",
    connectionLost: "Connection lost.",
    actionFailed: "Action failed.",
    joinFailed: "Could not join room.",
    copyFailed: "Could not copy room link.",
    needPlayers: (minPlayers: number) => `At least ${minPlayers} players are required to start.`
  },
  ru: {
    connecting: "Подключение",
    loadingRoom: "Загрузка комнаты...",
    roomUnavailable: "Комната недоступна",
    cannotLoadRoom: "Не удалось загрузить комнату.",
    backHome: "На главную",
    room: "Комната",
    joinLobby: "Вход в лобби",
    players: "Игроков",
    phase: "Фаза",
    enterNameToJoin: "Введите имя, чтобы присоединиться к комнате.",
    roundInProgressJoinLater: "Сейчас идет раунд. Форма входа откроется, когда начнется лобби.",
    displayName: "Имя игрока",
    yourName: "Ваше имя",
    passwordIfRequired: "Пароль (если есть)",
    roomPassword: "Пароль комнаты",
    joining: "Вход...",
    joinRoom: "Войти в комнату",
    copyLink: "Копировать ссылку",
    linkCopied: "Ссылка скопирована",
    leave: "Выйти",
    inRoom: "в комнате",
    host: "Хост",
    voted: "Проголосовал",
    you: "Вы",
    lobby: "Лобби",
    discussionTimer: "Таймер обсуждения",
    minutesShort: "мин",
    imposterCount: "Количество импостеров",
    saveSettings: "Сохранить настройки",
    saving: "Сохранение...",
    startGame: "Начать игру",
    starting: "Запуск...",
    roomFactLanguage: "Язык фактов в комнате",
    english: "Английский",
    russian: "Русский",
    waitingHostStart: "Ожидайте, пока хост настроит параметры и запустит раунд.",
    discussion: "Обсуждение",
    yourCard: "Ваша карточка",
    extend30: "+30 сек",
    extend60: "+1 мин",
    extending: "Продление...",
    endDiscussion: "Завершить обсуждение",
    endingDiscussion: "Завершение...",
    discussionHint: "Обсудите факты в группе. После таймера начнется голосование.",
    votingTitle: "Голосование: кто получил фейковый факт?",
    yourVotePrefix: "Ваш голос:",
    revealEarly: "Открыть раньше",
    revealing: "Открытие...",
    results: "Результаты",
    imposters: "Импостеры",
    none: "Нет",
    votes: "Голоса",
    noVotes: "Голоса отсутствуют.",
    dealtCards: "Выданные карточки",
    cardsUnavailable: "Карточки недоступны.",
    roundFacts: "Факты раунда",
    realFacts: "Реальные факты",
    fakeFacts: "Фейковые факты",
    factsUnavailable: "Список фактов недоступен.",
    truth: "Правда",
    fake: "Фейк",
    roleImposter: "Импостер",
    roleTruth: "Правда",
    unknown: "Неизвестно",
    playAgain: "Следующий раунд",
    backToLobby: "Вернуться в лобби",
    returning: "Возврат...",
    waitingHostDecision: "Ожидайте решения хоста: новый раунд или возврат в лобби.",
    enterNameError: "Введите имя игрока.",
    syncFailed: "Не удалось синхронизировать состояние комнаты.",
    connectionLost: "Потеряно соединение.",
    actionFailed: "Не удалось выполнить действие.",
    joinFailed: "Не удалось войти в комнату.",
    copyFailed: "Не удалось скопировать ссылку.",
    needPlayers: (minPlayers: number) => `Для старта нужно минимум ${minPlayers} игрока(ов).`
  }
} as const;

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

function roleLabel(language: Language, role: "truth" | "imposter" | null | undefined): string {
  const copy = COPY[language];
  return role === "imposter" ? copy.roleImposter : copy.roleTruth;
}

export function RoomClient({ roomCode }: RoomClientProps) {
  const router = useRouter();
  const normalizedRoomCode = roomCode.toUpperCase();
  const [sessionId, setSessionId] = useState("");
  const [uiLanguage, setUiLanguage] = useState<Language>("en");
  const [state, setState] = useState<RoomView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [settingsDiscussionMinutes, setSettingsDiscussionMinutes] = useState(2);
  const [settingsImposters, setSettingsImposters] = useState(1);
  const [settingsLanguage, setSettingsLanguage] = useState<Language>("en");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const versionRef = useRef(0);
  const syncedDiscussionMinutes = state?.settings.discussionMinutes;
  const syncedImposters = state?.settings.imposters;
  const syncedLanguage = state?.settings.language;

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    setUiLanguage(getStoredLanguage());
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
    if (
      syncedDiscussionMinutes === undefined ||
      syncedImposters === undefined ||
      syncedLanguage === undefined
    ) {
      return;
    }

    setSettingsDiscussionMinutes(syncedDiscussionMinutes);
    setSettingsImposters(syncedImposters);
    setSettingsLanguage(syncedLanguage);
  }, [syncedDiscussionMinutes, syncedImposters, syncedLanguage]);

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
            throw new Error(payload.error ?? COPY[uiLanguage].syncFailed);
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
          setError(pollError instanceof Error ? pollError.message : COPY[uiLanguage].connectionLost);
          await delay(POLL_ERROR_RETRY_MS);
        }
      }
    }

    void pollRoom();

    return () => {
      cancelled = true;
    };
  }, [normalizedRoomCode, sessionId, uiLanguage]);

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
      setError(actionError instanceof Error ? actionError.message : COPY[uiLanguage].actionFailed);
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
      setError(COPY[uiLanguage].enterNameError);
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
      setError(joinError instanceof Error ? joinError.message : COPY[uiLanguage].joinFailed);
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
      setError(COPY[uiLanguage].copyFailed);
    }
  }

  function updateLanguage(nextLanguage: Language) {
    setUiLanguage(nextLanguage);
    setStoredLanguage(nextLanguage);
  }

  const copy = COPY[uiLanguage];
  const localizedGame = state ? gameText(state.gameId, uiLanguage) : gameText("fact-or-fake", uiLanguage);
  const isHost = Boolean(state?.joined && state.hostId && state.meId && state.hostId === state.meId);
  const phase = state?.phase;
  const maxImposters = state ? Math.max(1, Math.min(3, state.players.length - 2)) : 1;
  const discussionSecondsLeft =
    state?.phase === "discussion" && state.round?.discussionEndsAt
      ? Math.max(0, Math.ceil((state.round.discussionEndsAt - now) / 1000))
      : 0;
  const roundRealFacts = state?.round?.facts?.real ?? [];
  const roundFakeFacts = state?.round?.facts?.fake ?? [];
  const totalRoundFacts = roundRealFacts.length + roundFakeFacts.length;

  const playersById = useMemo(() => {
    if (!state) {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(state.players.map((player) => [player.id, player.displayName]));
  }, [state]);

  if (!sessionId || (loading && !state)) {
    return (
      <div className="panel stack-md">
        <div className="row-wrap space-between">
          <p className="eyebrow">{copy.connecting}</p>
          <LanguageToggle language={uiLanguage} onChange={updateLanguage} />
        </div>
        <h1 className="title-lg">{copy.loadingRoom}</h1>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="panel stack-md">
        <div className="row-wrap space-between">
          <h1 className="title-lg">{copy.roomUnavailable}</h1>
          <LanguageToggle language={uiLanguage} onChange={updateLanguage} />
        </div>
        <p className="error-text">{error ?? copy.cannotLoadRoom}</p>
        <Link href="/" className="text-link">
          {copy.backHome}
        </Link>
      </div>
    );
  }

  if (!state.joined) {
    return (
      <div className="panel stack-lg fade-up">
        <div className="stack-sm">
          <div className="row-wrap space-between">
            <p className="eyebrow">
              {copy.room} {state.roomCode}
            </p>
            <LanguageToggle language={uiLanguage} onChange={updateLanguage} />
          </div>
          <h1 className="title-lg">{copy.joinLobby}</h1>
          <p className="muted">{state.phase === "lobby" ? copy.enterNameToJoin : copy.roundInProgressJoinLater}</p>
        </div>

        <div className="pill-row">
          <span className="pill">
            {copy.players}: {state.players.length}
          </span>
          <span className="pill">
            {copy.phase}: {phaseText(uiLanguage, state.phase)}
          </span>
        </div>

        {state.phase === "lobby" ? (
          <form className="stack-md" onSubmit={handleJoinRoom}>
            <label className="input-label" htmlFor="join-display-name">
              {copy.displayName}
            </label>
            <input
              id="join-display-name"
              className="text-input"
              value={joinName}
              onChange={(event) => setJoinName(event.target.value)}
              placeholder={copy.yourName}
              maxLength={24}
              autoComplete="nickname"
            />

            <label className="input-label" htmlFor="join-room-password">
              {copy.passwordIfRequired}
            </label>
            <input
              id="join-room-password"
              className="text-input"
              value={joinPassword}
              onChange={(event) => setJoinPassword(event.target.value)}
              placeholder={copy.roomPassword}
              autoComplete="off"
            />

            <button className="button-primary" type="submit" disabled={workingAction === "join_room"}>
              {workingAction === "join_room" ? copy.joining : copy.joinRoom}
            </button>
          </form>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}

        <Link href="/" className="text-link">
          {copy.backHome}
        </Link>
      </div>
    );
  }

  return (
    <div className="stack-lg fade-up">
      <section className="panel stack-md">
        <div className="row-wrap space-between">
          <div className="stack-xs">
            <p className="eyebrow">
              {copy.room} {state.roomCode}
            </p>
            <h1 className="title-lg">{localizedGame.title}</h1>
          </div>
          <div className="pill-row">
            <LanguageToggle language={uiLanguage} onChange={updateLanguage} />
            <span className="pill">
              {copy.phase}: {phase ? phaseText(uiLanguage, phase) : "-"}
            </span>
            <button className="button-ghost" type="button" onClick={copyRoomLink}>
              {copied ? copy.linkCopied : copy.copyLink}
            </button>
            <button className="button-ghost" type="button" onClick={() => sendAction({ type: "leave_room" })}>
              {copy.leave}
            </button>
          </div>
        </div>

        {phase === "lobby" && state.players.length < state.minPlayers ? (
          <p className="muted">{copy.needPlayers(state.minPlayers)}</p>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="panel stack-md">
        <div className="row-wrap space-between">
          <h2 className="title-sm">{copy.players}</h2>
          <span className="muted">
            {state.players.length} {copy.inRoom}
          </span>
        </div>
        <div className="player-grid">
          {state.players.map((player) => (
            <article key={player.id} className="player-card">
              <div className="row-wrap space-between">
                <p>{player.displayName}</p>
                <span className="muted">{player.score} pts</span>
              </div>
              <div className="pill-row">
                {player.isHost ? <span className="pill">{copy.host}</span> : null}
                {player.hasVoted ? <span className="pill">{copy.voted}</span> : null}
                {player.id === state.meId ? <span className="pill">{copy.you}</span> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {phase === "lobby" ? (
        <section className="panel stack-md slide-up">
          <h2 className="title-sm">{copy.lobby}</h2>

          {isHost ? (
            <>
              <div className="stack-sm">
                <label className="input-label" htmlFor="discussion-minutes">
                  {copy.discussionTimer}: {settingsDiscussionMinutes} {copy.minutesShort}
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
                  {copy.imposterCount}
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

              <div className="stack-sm">
                <label className="input-label" htmlFor="room-language-select">
                  {copy.roomFactLanguage}
                </label>
                <select
                  id="room-language-select"
                  className="text-input"
                  value={settingsLanguage}
                  onChange={(event) => setSettingsLanguage(event.target.value as Language)}
                >
                  <option value="en">{copy.english}</option>
                  <option value="ru">{copy.russian}</option>
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
                      imposters: settingsImposters,
                      language: settingsLanguage
                    })
                  }
                  disabled={workingAction === "update_settings"}
                >
                  {workingAction === "update_settings" ? copy.saving : copy.saveSettings}
                </button>

                <button
                  className="button-primary"
                  type="button"
                  onClick={() => sendAction({ type: "start_round" })}
                  disabled={!state.canStart || workingAction === "start_round"}
                >
                  {workingAction === "start_round" ? copy.starting : copy.startGame}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">{copy.waitingHostStart}</p>
          )}
        </section>
      ) : null}

      {phase === "discussion" ? (
        <section className="panel stack-md slide-up">
          <div className="row-wrap space-between">
            <h2 className="title-sm">{copy.discussion}</h2>
            <p className="timer">{formatCountdown(discussionSecondsLeft)}</p>
          </div>

          <article className="card-panel">
            <p className="eyebrow">{copy.yourCard}</p>
            <h3 className={state.round?.myRole === "imposter" ? "role-badge imposter" : "role-badge truth"}>
              {roleLabel(uiLanguage, state.round?.myRole)}
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
                {workingAction === "extend_discussion" ? copy.extending : copy.extend30}
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={() => sendAction({ type: "extend_discussion", seconds: 60 })}
                disabled={workingAction === "extend_discussion"}
              >
                {workingAction === "extend_discussion" ? copy.extending : copy.extend60}
              </button>
              <button
                className="button-primary"
                type="button"
                onClick={() => sendAction({ type: "end_discussion" })}
                disabled={workingAction === "end_discussion"}
              >
                {workingAction === "end_discussion" ? copy.endingDiscussion : copy.endDiscussion}
              </button>
            </div>
          ) : (
            <p className="muted">{copy.discussionHint}</p>
          )}
        </section>
      ) : null}

      {phase === "voting" ? (
        <section className="panel stack-md slide-up">
          <h2 className="title-sm">{copy.votingTitle}</h2>

          <article className="card-panel">
            <p className="eyebrow">{copy.yourCard}</p>
            <h3 className={state.round?.myRole === "imposter" ? "role-badge imposter" : "role-badge truth"}>
              {roleLabel(uiLanguage, state.round?.myRole)}
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
            {state.round?.myVote ? (
              <p className="muted">
                {copy.yourVotePrefix} {playersById[state.round.myVote]}.
              </p>
            ) : (
              <p />
            )}

            {isHost ? (
              <button
                className="button-secondary"
                type="button"
                onClick={() => sendAction({ type: "reveal_results" })}
                disabled={workingAction === "reveal_results"}
              >
                {workingAction === "reveal_results" ? copy.revealing : copy.revealEarly}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {phase === "results" ? (
        <section className="panel stack-md slide-up">
          <h2 className="title-sm">{copy.results}</h2>

          <article className="card-panel">
            <p className="eyebrow">{copy.imposters}</p>
            <p>
              {(state.round?.imposters ?? []).map((playerId) => playersById[playerId] ?? copy.unknown).join(", ") ||
                copy.none}
            </p>
          </article>

          <div className="stack-sm">
            <h3 className="title-xs">{copy.votes}</h3>
            {state.round?.votes && Object.keys(state.round.votes).length > 0 ? (
              <div className="stack-xs">
                {Object.entries(state.round.votes).map(([voterId, targetId]) => (
                  <p key={voterId} className="muted">
                    {playersById[voterId] ?? copy.unknown} → {playersById[targetId] ?? copy.unknown}
                  </p>
                ))}
              </div>
            ) : (
              <p className="muted">{copy.noVotes}</p>
            )}
          </div>

          <div className="stack-sm">
            <h3 className="title-xs">{copy.dealtCards}</h3>
            {state.round?.cards ? (
              <div className="stack-xs">
                {Object.entries(state.round.cards).map(([playerId, cardInfo]) => (
                  <p key={playerId} className="muted">
                    <strong>{playersById[playerId] ?? copy.unknown}:</strong> {cardInfo.card} ({roleLabel(uiLanguage, cardInfo.role)})
                  </p>
                ))}
              </div>
            ) : (
              <p className="muted">{copy.cardsUnavailable}</p>
            )}
          </div>

          <div className="stack-sm">
            <h3 className="title-xs">
              {copy.roundFacts} ({totalRoundFacts})
            </h3>
            {totalRoundFacts > 0 ? (
              <div className="stack-xs">
                <p className="muted">
                  <strong>{copy.realFacts}</strong>: {roundRealFacts.length}
                </p>
                {roundRealFacts.map((fact) => (
                  <p key={fact.id} className="muted">
                    <strong>{fact.category}:</strong> {fact.text}
                  </p>
                ))}
                <p className="muted">
                  <strong>{copy.fakeFacts}</strong>: {roundFakeFacts.length}
                </p>
                {roundFakeFacts.map((fact) => (
                  <p key={fact.id} className="muted">
                    <strong>{fact.category}:</strong> {fact.text}
                  </p>
                ))}
              </div>
            ) : (
              <p className="muted">{copy.factsUnavailable}</p>
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
                {workingAction === "play_again" ? copy.starting : copy.playAgain}
              </button>

              <button
                className="button-secondary"
                type="button"
                onClick={() => sendAction({ type: "back_to_lobby" })}
                disabled={workingAction === "back_to_lobby"}
              >
                {workingAction === "back_to_lobby" ? copy.returning : copy.backToLobby}
              </button>
            </div>
          ) : (
            <p className="muted">{copy.waitingHostDecision}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
