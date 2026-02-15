import { getFactsForGame, getGame } from "@/lib/games/registry";
import { AppError } from "@/lib/server/errors";
import { getRoomStore } from "@/lib/server/store";
import {
  generateRoomCode,
  normalizeRoomCode,
  sanitizeDisplayName,
  sanitizePassword,
  sleep
} from "@/lib/server/utils";
import {
  DEFAULT_SETTINGS,
  MAX_DISCUSSION_MINUTES,
  MIN_DISCUSSION_MINUTES,
  MIN_PLAYERS,
  type ActionInput,
  type AssignmentRecord,
  type CreateRoomInput,
  type FactPair,
  type JoinRoomInput,
  type PlayerRecord,
  type RoomRecord,
  type RoomView
} from "@/lib/shared/types";

const MAX_ROOM_CODE_ATTEMPTS = 30;
const LONG_POLL_TIMEOUT_MS = 20_000;
const LONG_POLL_INTERVAL_MS = 900;
const MIN_EXTEND_SECONDS = 15;
const MAX_EXTEND_SECONDS = 300;

function requireSessionId(sessionId: string): string {
  const value = sessionId.trim();

  if (!value) {
    throw new AppError(400, "Отсутствует идентификатор сессии.");
  }

  return value;
}

function markUpdated(room: RoomRecord): void {
  room.updatedAt = Date.now();
  room.version += 1;
}

function toSortedPlayers(room: RoomRecord) {
  return Object.values(room.players).sort((first, second) => first.joinedAt - second.joinedAt);
}

function shuffle<T>(values: T[]): T[] {
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const original = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = original;
  }

  return copy;
}

function pickFactsForRound(gameId: RoomRecord["gameId"], requiredCount: number, recentFactIds: Set<string>): FactPair[] {
  const facts = getFactsForGame(gameId);

  if (facts.length === 0) {
    throw new AppError(500, "Для этой игры не настроены факты.");
  }

  if (facts.length < requiredCount) {
    throw new AppError(
      409,
      `Недостаточно фактов для уникальной раздачи. Нужно минимум ${requiredCount}, доступно ${facts.length}.`
    );
  }

  const candidates = facts.filter((fact) => !recentFactIds.has(fact.id));
  const pool = candidates.length >= requiredCount ? candidates : facts;

  return shuffle(pool).slice(0, requiredCount);
}

function computeMaxImposters(room: RoomRecord): number {
  const game = getGame(room.gameId);
  const maxByPlayerCount = Math.max(1, toSortedPlayers(room).length - 2);
  const maxByGame = game?.maxImposters ?? 1;

  return Math.max(1, Math.min(maxByPlayerCount, maxByGame));
}

function clampDiscussionMinutes(value: number): number {
  return Math.min(MAX_DISCUSSION_MINUTES, Math.max(MIN_DISCUSSION_MINUTES, Math.round(value)));
}

function clampImposters(room: RoomRecord, value: number): number {
  const maxImposters = computeMaxImposters(room);
  return Math.min(maxImposters, Math.max(1, Math.round(value)));
}

function normalizeExtendSeconds(value: number): number {
  return Math.min(MAX_EXTEND_SECONDS, Math.max(MIN_EXTEND_SECONDS, Math.round(value)));
}

function buildVoteCounts(votes: Record<string, string>): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const voteTarget of Object.values(votes)) {
    counts[voteTarget] = (counts[voteTarget] ?? 0) + 1;
  }

  return counts;
}

function haveAllPlayersVoted(room: RoomRecord): boolean {
  if (!room.round) {
    return false;
  }

  const playerIds = Object.keys(room.players);
  return playerIds.length > 0 && playerIds.every((playerId) => Boolean(room.round?.votes[playerId]));
}

function finalizeRound(room: RoomRecord): void {
  if (!room.round) {
    throw new AppError(409, "Нет активного раунда для показа результатов.");
  }

  const imposters = Object.entries(room.round.assignments)
    .filter(([, assignment]) => assignment.role === "imposter")
    .map(([playerId]) => playerId);
  const voteCounts = buildVoteCounts(room.round.votes);
  const imposterSet = new Set(imposters);
  const activePlayers = toSortedPlayers(room);

  for (const player of activePlayers) {
    const vote = room.round.votes[player.id];

    if (!vote) {
      continue;
    }

    if (!imposterSet.has(player.id) && imposterSet.has(vote)) {
      player.score += 1;
    }
  }

  const survivalThreshold = Math.ceil(activePlayers.length / 2);

  for (const imposterId of imposters) {
    const votesAgainst = voteCounts[imposterId] ?? 0;

    if (votesAgainst < survivalThreshold && room.players[imposterId]) {
      room.players[imposterId].score += 1;
    }
  }

  const factMap = new Map<string, FactPair>();

  for (const assignment of Object.values(room.round.assignments)) {
    if (!factMap.has(assignment.factId)) {
      factMap.set(assignment.factId, {
        id: assignment.factId,
        category: assignment.category,
        realFact: assignment.realFact,
        fakeFact: assignment.fakeFact
      });
    }
  }

  room.round.revealed = true;
  room.round.result = {
    votes: { ...room.round.votes },
    voteCounts,
    imposters,
    cards: Object.fromEntries(
      Object.entries(room.round.assignments).map(([playerId, assignment]) => [playerId, { ...assignment }])
    ),
    facts: [...factMap.values()]
  };
  room.phase = "results";
  markUpdated(room);
}

function applyAutomaticTransitions(room: RoomRecord): boolean {
  if (!room.round) {
    return false;
  }

  let changed = false;

  if (room.phase === "discussion" && Date.now() >= room.round.discussionEndsAt) {
    room.phase = "voting";
    markUpdated(room);
    changed = true;
  }

  if (room.phase === "voting" && haveAllPlayersVoted(room)) {
    finalizeRound(room);
    changed = true;
  }

  return changed;
}

function startRound(room: RoomRecord): void {
  const players = toSortedPlayers(room);

  if (players.length < MIN_PLAYERS) {
    throw new AppError(409, `Для старта нужно минимум ${MIN_PLAYERS} игрока(ов).`);
  }

  const impostersToAssign = clampImposters(room, room.settings.imposters);
  room.settings.imposters = impostersToAssign;

  const playerIds = shuffle(players.map((player) => player.id));
  const recentFactIds = new Set(room.round?.usedFactIds ?? []);
  const factsForRound = pickFactsForRound(room.gameId, playerIds.length, recentFactIds);
  const imposterIds = new Set(playerIds.slice(0, impostersToAssign));
  const assignments: Record<string, AssignmentRecord> = {};

  for (let index = 0; index < playerIds.length; index += 1) {
    const playerId = playerIds[index];
    const fact = factsForRound[index];
    const isImposter = imposterIds.has(playerId);

    assignments[playerId] = {
      role: isImposter ? "imposter" : "truth",
      card: isImposter ? fact.fakeFact : fact.realFact,
      factId: fact.id,
      category: fact.category,
      realFact: fact.realFact,
      fakeFact: fact.fakeFact
    };
  }

  room.round = {
    roundNumber: (room.round?.roundNumber ?? 0) + 1,
    usedFactIds: factsForRound.map((fact) => fact.id),
    assignments,
    discussionEndsAt: Date.now() + room.settings.discussionMinutes * 60_000,
    votes: {},
    revealed: false,
    result: null
  };
  room.phase = "discussion";
  markUpdated(room);
}

function endDiscussion(room: RoomRecord): void {
  if (!room.round || room.phase !== "discussion") {
    throw new AppError(409, "Обсуждение сейчас неактивно.");
  }

  room.phase = "voting";
  markUpdated(room);
}

function extendDiscussion(room: RoomRecord, seconds: number): void {
  if (!room.round || room.phase !== "discussion") {
    throw new AppError(409, "Обсуждение сейчас неактивно.");
  }

  const safeSeconds = normalizeExtendSeconds(seconds);
  room.round.discussionEndsAt += safeSeconds * 1000;
  markUpdated(room);
}

function requireHost(room: RoomRecord, sessionId: string): void {
  if (room.hostId !== sessionId) {
    throw new AppError(403, "Только хост комнаты может выполнить это действие.");
  }
}

function ensurePlayerInRoom(room: RoomRecord, sessionId: string): PlayerRecord {
  const player = room.players[sessionId];

  if (!player) {
    throw new AppError(403, "Вы не состоите в этой комнате.");
  }

  return player;
}

function updateSettings(room: RoomRecord, sessionId: string, discussionMinutes: number, imposters: number): void {
  requireHost(room, sessionId);

  if (room.phase !== "lobby") {
    throw new AppError(409, "Настройки можно менять только в лобби.");
  }

  const nextDiscussionMinutes = clampDiscussionMinutes(discussionMinutes);
  const nextImposters = clampImposters(room, imposters);

  if (
    nextDiscussionMinutes !== room.settings.discussionMinutes ||
    nextImposters !== room.settings.imposters
  ) {
    room.settings.discussionMinutes = nextDiscussionMinutes;
    room.settings.imposters = nextImposters;
    markUpdated(room);
  }
}

function castVote(room: RoomRecord, sessionId: string, targetPlayerId: string): void {
  if (!room.round || room.phase !== "voting") {
    throw new AppError(409, "Голосование сейчас неактивно.");
  }

  if (!room.players[targetPlayerId]) {
    throw new AppError(404, "Игрок для голоса не найден.");
  }

  if (targetPlayerId === sessionId) {
    throw new AppError(409, "Нельзя голосовать за себя.");
  }

  room.round.votes[sessionId] = targetPlayerId;

  if (haveAllPlayersVoted(room)) {
    finalizeRound(room);
    return;
  }

  markUpdated(room);
}

function leaveRoom(room: RoomRecord, sessionId: string): "deleted" | "updated" {
  if (!room.players[sessionId]) {
    return "updated";
  }

  delete room.players[sessionId];

  const remainingPlayers = toSortedPlayers(room);

  if (remainingPlayers.length === 0) {
    return "deleted";
  }

  if (room.hostId === sessionId) {
    room.hostId = remainingPlayers[0].id;
  }

  if (room.phase !== "lobby" && remainingPlayers.length < MIN_PLAYERS) {
    room.phase = "lobby";
    room.round = null;
    markUpdated(room);
    return "updated";
  }

  if (room.phase === "voting" && room.round && haveAllPlayersVoted(room)) {
    finalizeRound(room);
    return "updated";
  }

  markUpdated(room);
  return "updated";
}

function buildClosedRoomView(code: string): RoomView {
  return {
    joined: false,
    roomCode: code,
    gameId: "fact-or-fake",
    version: 0,
    phase: "lobby",
    settings: { ...DEFAULT_SETTINGS },
    minPlayers: MIN_PLAYERS,
    players: [],
    hostId: null,
    meId: null,
    canStart: false,
    requiresPassword: false,
    round: null,
    message: "Эта комната уже закрыта."
  };
}

export function buildRoomView(room: RoomRecord, sessionId: string): RoomView {
  const players = toSortedPlayers(room);
  const me = room.players[sessionId] ?? null;

  const publicPlayers = players.map((player) => ({
    id: player.id,
    displayName: player.displayName,
    score: player.score,
    isHost: room.hostId === player.id,
    hasVoted: room.phase === "voting" || room.phase === "results" ? Boolean(room.round?.votes[player.id]) : false
  }));

  if (!me) {
    return {
      joined: false,
      roomCode: room.code,
      gameId: room.gameId,
      version: room.version,
      phase: room.phase,
      settings: room.settings,
      minPlayers: MIN_PLAYERS,
      players: publicPlayers,
      hostId: room.hostId,
      meId: null,
      canStart: false,
      requiresPassword: Boolean(room.password),
      round: null,
      message:
        room.phase === "lobby"
          ? "Введите имя, чтобы присоединиться к комнате."
          : "Сейчас идет раунд. Вход откроется, когда комната вернется в лобби."
    };
  }

  let round = null;

  if (room.round) {
    const assignment = room.round.assignments[sessionId] ?? null;
    const result = room.round.result;

    round = {
      roundNumber: room.round.roundNumber,
      discussionEndsAt: room.phase === "discussion" ? room.round.discussionEndsAt : null,
      myCard: assignment?.card ?? null,
      myRole: assignment?.role ?? null,
      myVote: room.round.votes[sessionId] ?? null,
      imposters: room.phase === "results" ? result?.imposters ?? null : null,
      votes: room.phase === "results" ? result?.votes ?? null : null,
      voteCounts: room.phase === "results" ? result?.voteCounts ?? null : null,
      cards: room.phase === "results" ? result?.cards ?? null : null,
      facts: room.phase === "results" ? result?.facts ?? null : null
    };
  }

  const hostControlsStart = room.hostId === sessionId && room.phase === "lobby" && players.length >= MIN_PLAYERS;
  const message =
    room.phase === "lobby" && players.length < MIN_PLAYERS
      ? `Для старта нужно минимум ${MIN_PLAYERS} игрока(ов).`
      : null;

  return {
    joined: true,
    roomCode: room.code,
    gameId: room.gameId,
    version: room.version,
    phase: room.phase,
    settings: room.settings,
    minPlayers: MIN_PLAYERS,
    players: publicPlayers,
    hostId: room.hostId,
    meId: sessionId,
    canStart: hostControlsStart,
    requiresPassword: Boolean(room.password),
    round,
    message
  };
}

export async function createRoom(input: CreateRoomInput): Promise<RoomView> {
  const sessionId = requireSessionId(input.sessionId);
  const displayName = sanitizeDisplayName(input.displayName);

  if (!displayName) {
    throw new AppError(400, "Имя игрока обязательно.");
  }

  const game = getGame(input.gameId);

  if (!game) {
    throw new AppError(404, "Игра не найдена.");
  }

  const store = getRoomStore();
  let roomCode = "";

  for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt += 1) {
    const candidate = generateRoomCode();
    const existingRoom = await store.getRoom(candidate);

    if (!existingRoom) {
      roomCode = candidate;
      break;
    }
  }

  if (!roomCode) {
    throw new AppError(500, "Не удалось создать код комнаты. Попробуйте еще раз.");
  }

  const now = Date.now();

  const room: RoomRecord = {
    code: roomCode,
    gameId: game.id,
    hostId: sessionId,
    password: sanitizePassword(input.password),
    createdAt: now,
    updatedAt: now,
    version: 1,
    phase: "lobby",
    settings: { ...DEFAULT_SETTINGS },
    players: {
      [sessionId]: {
        id: sessionId,
        displayName,
        joinedAt: now,
        score: 0
      }
    },
    round: null
  };

  await store.setRoom(room);
  return buildRoomView(room, sessionId);
}

export async function joinRoom(input: JoinRoomInput): Promise<RoomView> {
  const sessionId = requireSessionId(input.sessionId);
  const displayName = sanitizeDisplayName(input.displayName);

  if (!displayName) {
    throw new AppError(400, "Имя игрока обязательно.");
  }

  const roomCode = normalizeRoomCode(input.roomCode);

  if (!roomCode) {
    throw new AppError(400, "Код комнаты обязателен.");
  }

  const store = getRoomStore();
  const room = await store.getRoom(roomCode);

  if (!room) {
    throw new AppError(404, "Комната не найдена.");
  }

  const password = sanitizePassword(input.password);

  if (room.password && room.password !== password) {
    throw new AppError(403, "Неверный пароль комнаты.");
  }

  const transitionChanged = applyAutomaticTransitions(room);

  if (transitionChanged) {
    await store.setRoom(room);
  }

  const existingPlayer = room.players[sessionId];

  if (existingPlayer) {
    if (existingPlayer.displayName !== displayName) {
      existingPlayer.displayName = displayName;
      markUpdated(room);
      await store.setRoom(room);
    }

    return buildRoomView(room, sessionId);
  }

  if (room.phase !== "lobby") {
    throw new AppError(409, "Раунд уже идет. Подключитесь, когда начнется лобби.");
  }

  room.players[sessionId] = {
    id: sessionId,
    displayName,
    joinedAt: Date.now(),
    score: 0
  };
  markUpdated(room);

  await store.setRoom(room);
  return buildRoomView(room, sessionId);
}

export async function performAction(roomCode: string, input: ActionInput): Promise<RoomView> {
  const code = normalizeRoomCode(roomCode);
  const sessionId = requireSessionId(input.sessionId);

  if (!code) {
    throw new AppError(400, "Код комнаты обязателен.");
  }

  const store = getRoomStore();
  const room = await store.getRoom(code);

  if (!room) {
    throw new AppError(404, "Комната не найдена.");
  }

  let changed = applyAutomaticTransitions(room);

  if (input.action.type !== "leave_room") {
    ensurePlayerInRoom(room, sessionId);
  }

  switch (input.action.type) {
    case "update_settings": {
      const previousVersion = room.version;
      updateSettings(room, sessionId, input.action.discussionMinutes, input.action.imposters);
      changed = changed || room.version !== previousVersion;
      break;
    }
    case "start_round": {
      requireHost(room, sessionId);

      if (room.phase !== "lobby") {
        throw new AppError(409, "Игру можно запустить только из лобби.");
      }

      startRound(room);
      changed = true;
      break;
    }
    case "cast_vote": {
      ensurePlayerInRoom(room, sessionId);
      const previousVersion = room.version;
      castVote(room, sessionId, input.action.targetPlayerId);
      changed = changed || room.version !== previousVersion;
      break;
    }
    case "reveal_results": {
      requireHost(room, sessionId);

      if (room.phase !== "voting") {
        throw new AppError(409, "Результаты можно открыть только во время голосования.");
      }

      finalizeRound(room);
      changed = true;
      break;
    }
    case "end_discussion": {
      requireHost(room, sessionId);
      endDiscussion(room);
      changed = true;
      break;
    }
    case "extend_discussion": {
      requireHost(room, sessionId);
      extendDiscussion(room, input.action.seconds);
      changed = true;
      break;
    }
    case "play_again": {
      requireHost(room, sessionId);

      if (room.phase !== "results" && room.phase !== "lobby") {
        throw new AppError(409, "Сначала завершите текущий раунд.");
      }

      startRound(room);
      changed = true;
      break;
    }
    case "back_to_lobby": {
      requireHost(room, sessionId);

      if (room.phase !== "results") {
        throw new AppError(409, "Вернуться в лобби можно только после результатов.");
      }

      room.phase = "lobby";
      room.round = null;
      markUpdated(room);
      changed = true;
      break;
    }
    case "leave_room": {
      const leaveState = leaveRoom(room, sessionId);

      if (leaveState === "deleted") {
        await store.deleteRoom(room.code);
        return buildClosedRoomView(room.code);
      }

      changed = true;
      break;
    }
    default:
      throw new AppError(400, "Неподдерживаемое действие.");
  }

  const transitionedAfterAction = applyAutomaticTransitions(room);
  changed = changed || transitionedAfterAction;

  if (changed) {
    await store.setRoom(room);
  }

  return buildRoomView(room, sessionId);
}

export async function syncRoomView(roomCode: string, sessionId: string, sinceVersion: number): Promise<RoomView> {
  const code = normalizeRoomCode(roomCode);
  const memberSessionId = requireSessionId(sessionId);

  if (!code) {
    throw new AppError(400, "Код комнаты обязателен.");
  }

  const store = getRoomStore();
  const startedAt = Date.now();

  while (Date.now() - startedAt < LONG_POLL_TIMEOUT_MS) {
    const room = await store.getRoom(code);

    if (!room) {
      throw new AppError(404, "Комната не найдена.");
    }

    const transitioned = applyAutomaticTransitions(room);

    if (transitioned) {
      await store.setRoom(room);
    }

    const view = buildRoomView(room, memberSessionId);

    if (view.version > sinceVersion || transitioned || sinceVersion <= 0) {
      return view;
    }

    await sleep(LONG_POLL_INTERVAL_MS);
  }

  const room = await store.getRoom(code);

  if (!room) {
    throw new AppError(404, "Комната не найдена.");
  }

  return buildRoomView(room, memberSessionId);
}
