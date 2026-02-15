"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { LanguageToggle } from "@/components/language-toggle";
import { getStoredLanguage, setStoredLanguage } from "@/lib/client/language";
import { postJson } from "@/lib/client/http";
import { getOrCreateSessionId } from "@/lib/client/session";
import { gameText } from "@/lib/shared/i18n/language";
import type { GameSummary, Language, RoomView } from "@/lib/shared/types";

interface GameEntryClientProps {
  game: GameSummary;
}

const COPY = {
  en: {
    modeLabel: "Game Mode",
    totalFacts: "Total facts",
    createRoom: "Create Room",
    joinRoom: "Join Room",
    displayName: "Display name",
    passwordOptional: "Password (optional)",
    passwordIfRequired: "Password (if required)",
    yourName: "Your name",
    roomPassword: "Room password",
    emptyRoomPassword: "Leave empty for open room",
    roomCode: "Room code",
    creating: "Creating...",
    createAction: "Create Room",
    joining: "Joining...",
    joinAction: "Join Room",
    minPlayers: "Min players",
    backToGames: "Back to Game Box",
    languageLabel: "Language",
    roomLanguage: "Room fact language",
    english: "English",
    russian: "Russian",
    enterName: "Display name is required.",
    enterRoomCode: "Room code is required.",
    createFailed: "Could not create room.",
    joinFailed: "Could not join room."
  },
  ru: {
    modeLabel: "Режим игры",
    totalFacts: "Всего фактов",
    createRoom: "Создать комнату",
    joinRoom: "Войти в комнату",
    displayName: "Имя игрока",
    passwordOptional: "Пароль (необязательно)",
    passwordIfRequired: "Пароль (если есть)",
    yourName: "Ваше имя",
    roomPassword: "Пароль комнаты",
    emptyRoomPassword: "Оставьте пустым для открытой комнаты",
    roomCode: "Код комнаты",
    creating: "Создание...",
    createAction: "Создать комнату",
    joining: "Вход...",
    joinAction: "Войти в комнату",
    minPlayers: "Минимум игроков",
    backToGames: "Назад к списку игр",
    languageLabel: "Язык интерфейса",
    roomLanguage: "Язык фактов в комнате",
    english: "Английский",
    russian: "Русский",
    enterName: "Введите имя игрока.",
    enterRoomCode: "Введите код комнаты.",
    createFailed: "Не удалось создать комнату.",
    joinFailed: "Не удалось войти в комнату."
  }
} as const;

export function GameEntryClient({ game }: GameEntryClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [language, setLanguage] = useState<Language>("en");
  const [roomLanguage, setRoomLanguage] = useState<Language>("en");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedLanguage = getStoredLanguage();
    setLanguage(storedLanguage);
    setRoomLanguage(storedLanguage);
  }, []);

  function updateLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setStoredLanguage(nextLanguage);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!createName.trim()) {
      setError(copy.enterName);
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
        password: createPassword,
        language: roomLanguage
      });

      router.push(`/room/${response.state.roomCode}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.createFailed);
    } finally {
      setPending(false);
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!joinCode.trim()) {
      setError(copy.enterRoomCode);
      return;
    }

    if (!joinName.trim()) {
      setError(copy.enterName);
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
      setError(requestError instanceof Error ? requestError.message : copy.joinFailed);
    } finally {
      setPending(false);
    }
  }

  const copy = COPY[language];
  const localizedGame = gameText(game.id, language);

  return (
    <div className="panel stack-lg">
      <div className="row-wrap space-between">
        <p className="eyebrow">{copy.modeLabel}</p>
        <LanguageToggle language={language} onChange={updateLanguage} />
      </div>

      <div className="stack-sm">
        <h1 className="title-lg">{localizedGame.title}</h1>
        <p className="muted">{localizedGame.description}</p>
        <p className="muted">
          {copy.totalFacts}: {game.factCount}
        </p>
      </div>

      <div className="segmented-control" role="tablist" aria-label="Room entry mode">
        <button
          type="button"
          className={mode === "create" ? "segmented-active" : "segmented-button"}
          onClick={() => setMode("create")}
        >
          {copy.createRoom}
        </button>
        <button
          type="button"
          className={mode === "join" ? "segmented-active" : "segmented-button"}
          onClick={() => setMode("join")}
        >
          {copy.joinRoom}
        </button>
      </div>

      {mode === "create" ? (
        <form className="stack-md" onSubmit={handleCreate}>
          <label className="input-label" htmlFor="create-name">
            {copy.displayName}
          </label>
          <input
            id="create-name"
            className="text-input"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder={copy.yourName}
            maxLength={24}
            autoComplete="nickname"
          />

          <label className="input-label" htmlFor="create-password">
            {copy.passwordOptional}
          </label>
          <input
            id="create-password"
            className="text-input"
            value={createPassword}
            onChange={(event) => setCreatePassword(event.target.value)}
            placeholder={copy.emptyRoomPassword}
            autoComplete="off"
          />

          <label className="input-label" htmlFor="room-language">
            {copy.roomLanguage}
          </label>
          <select
            id="room-language"
            className="text-input"
            value={roomLanguage}
            onChange={(event) => setRoomLanguage(event.target.value as Language)}
          >
            <option value="en">{copy.english}</option>
            <option value="ru">{copy.russian}</option>
          </select>

          <button className="button-primary" type="submit" disabled={pending}>
            {pending ? copy.creating : copy.createAction}
          </button>
        </form>
      ) : (
        <form className="stack-md" onSubmit={handleJoin}>
          <label className="input-label" htmlFor="join-room-code">
            {copy.roomCode}
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
            {copy.displayName}
          </label>
          <input
            id="join-name"
            className="text-input"
            value={joinName}
            onChange={(event) => setJoinName(event.target.value)}
            placeholder={copy.yourName}
            maxLength={24}
            autoComplete="nickname"
          />

          <label className="input-label" htmlFor="join-password">
            {copy.passwordIfRequired}
          </label>
          <input
            id="join-password"
            className="text-input"
            value={joinPassword}
            onChange={(event) => setJoinPassword(event.target.value)}
            placeholder={copy.roomPassword}
            autoComplete="off"
          />

          <button className="button-primary" type="submit" disabled={pending}>
            {pending ? copy.joining : copy.joinAction}
          </button>
        </form>
      )}

      {error ? <p className="error-text">{error}</p> : null}

      <div className="stack-sm">
        <p className="muted">
          {copy.minPlayers}: {game.minPlayers}
        </p>
        <Link href="/" className="text-link">
          {copy.backToGames}
        </Link>
      </div>
    </div>
  );
}
