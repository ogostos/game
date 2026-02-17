import { normalizeLanguage } from "@/lib/shared/i18n/language";
import { getGame } from "@/lib/games/registry";
import { getFactsForGame } from "@/lib/games/facts";
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
  SWAP_LIMIT_PER_ROUND,
  type ActionInput,
  type AssignmentRecord,
  type CreateRoomInput,
  type FactCard,
  type FactDeck,
  type JoinRoomInput,
  type PlayerRecord,
  type RoomRecord,
  type RoomView,
  type TrueFalseAnswer
} from "@/lib/shared/types";

const MAX_ROOM_CODE_ATTEMPTS = 30;
const LONG_POLL_TIMEOUT_MS = 20_000;
const LONG_POLL_INTERVAL_MS = 900;
const MIN_EXTEND_SECONDS = 15;
const MAX_EXTEND_SECONDS = 300;

function requireSessionId(sessionId: string): string {
  const value = sessionId.trim();

  if (!value) {
    throw new AppError(400, "Missing session id.");
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

interface FactConflictKeys {
  realTextKeys: Set<string>;
  fakeTextKeys: Set<string>;
  fakeCorrectionKeys: Set<string>;
}

function createEmptyConflictKeys(): FactConflictKeys {
  return {
    realTextKeys: new Set<string>(),
    fakeTextKeys: new Set<string>(),
    fakeCorrectionKeys: new Set<string>()
  };
}

function normalizeFactKey(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectConflictKeysFromCards(realFacts: FactCard[], fakeFacts: FactCard[]): FactConflictKeys {
  const keys = createEmptyConflictKeys();

  for (const fact of realFacts) {
    const textKey = normalizeFactKey(fact.text);

    if (textKey) {
      keys.realTextKeys.add(textKey);
    }
  }

  for (const fact of fakeFacts) {
    const textKey = normalizeFactKey(fact.text);
    const correctionKey = normalizeFactKey(fact.correction);

    if (textKey) {
      keys.fakeTextKeys.add(textKey);
    }

    if (correctionKey) {
      keys.fakeCorrectionKeys.add(correctionKey);
    }
  }

  return keys;
}

function collectConflictKeysFromAssignments(
  assignments: Record<string, AssignmentRecord>,
  excludePlayerId?: string
): FactConflictKeys {
  const keys = createEmptyConflictKeys();

  for (const [playerId, assignment] of Object.entries(assignments)) {
    if (excludePlayerId && playerId === excludePlayerId) {
      continue;
    }

    const textKey = normalizeFactKey(assignment.card);
    const correctionKey = normalizeFactKey(assignment.factCorrection);

    if (assignment.factKind === "fake") {
      if (textKey) {
        keys.fakeTextKeys.add(textKey);
      }

      if (correctionKey) {
        keys.fakeCorrectionKeys.add(correctionKey);
      }
    } else if (textKey) {
      keys.realTextKeys.add(textKey);
    }
  }

  return keys;
}

function conflictsWithOppositeSide(
  fact: FactCard,
  factKind: "real" | "fake",
  conflictKeys: FactConflictKeys
): boolean {
  const textKey = normalizeFactKey(fact.text);

  if (!textKey) {
    return true;
  }

  if (factKind === "real") {
    return conflictKeys.fakeTextKeys.has(textKey) || conflictKeys.fakeCorrectionKeys.has(textKey);
  }

  const correctionKey = normalizeFactKey(fact.correction);

  return (
    conflictKeys.realTextKeys.has(textKey) ||
    (Boolean(correctionKey) && conflictKeys.realTextKeys.has(correctionKey))
  );
}

function pickFromPool(
  facts: FactCard[],
  recentFactIds: Set<string>,
  requiredCount: number,
  kindLabel: "real" | "fake"
): FactCard[] {
  if (facts.length === 0) {
    throw new AppError(500, `No ${kindLabel} facts configured for this game.`);
  }

  if (facts.length < requiredCount) {
    throw new AppError(
      409,
      `Not enough ${kindLabel} facts for unique dealing. Need at least ${requiredCount}, available ${facts.length}.`
    );
  }

  const candidates = facts.filter((fact) => !recentFactIds.has(fact.id));
  const pool = candidates.length >= requiredCount ? candidates : facts;

  return shuffle(pool).slice(0, requiredCount);
}

function pickFactsForRound(
  gameId: RoomRecord["gameId"],
  language: RoomRecord["settings"]["language"],
  truthCount: number,
  imposterCount: number,
  recentFactIds: Set<string>
): FactDeck {
  const facts = getFactsForGame(gameId, language);
  const selectedFakeFacts = pickFromPool(facts.fakeFacts, recentFactIds, imposterCount, "fake");
  const fakeConflictKeys = collectConflictKeysFromCards([], selectedFakeFacts);
  const compatibleRealFacts = facts.realFacts.filter(
    (fact) => !conflictsWithOppositeSide(fact, "real", fakeConflictKeys)
  );

  if (compatibleRealFacts.length < truthCount) {
    throw new AppError(
      409,
      `Not enough real facts that do not overlap with selected fake facts. Need ${truthCount}, available ${compatibleRealFacts.length}.`
    );
  }

  return {
    realFacts: pickFromPool(compatibleRealFacts, recentFactIds, truthCount, "real"),
    fakeFacts: selectedFakeFacts
  };
}

function minPlayersForRoom(room: RoomRecord): number {
  return getGame(room.gameId)?.minPlayers ?? MIN_PLAYERS;
}

function computeMaxImposters(room: RoomRecord): number {
  const game = getGame(room.gameId);

  if (!game?.supportsImposters) {
    return 1;
  }

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
    throw new AppError(409, "No active round to reveal.");
  }

  const voteCounts = buildVoteCounts(room.round.votes);
  const activePlayers = toSortedPlayers(room);
  const imposters =
    room.gameId === "fact-or-fake"
      ? Object.entries(room.round.assignments)
          .filter(([, assignment]) => assignment.role === "imposter")
          .map(([playerId]) => playerId)
      : [];

  if (room.gameId === "fact-or-fake") {
    const imposterSet = new Set(imposters);

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
  } else {
    const correctAnswer = room.round.correctAnswer;

    if (!correctAnswer) {
      throw new AppError(500, "True or False round has no correct answer.");
    }

    for (const player of activePlayers) {
      if (room.round.votes[player.id] === correctAnswer) {
        player.score += 1;
      }
    }
  }

  const realFacts = new Map<string, FactCard>();
  const fakeFacts = new Map<string, FactCard>();

  for (const assignment of Object.values(room.round.assignments)) {
    const targetPool = assignment.factKind === "fake" ? fakeFacts : realFacts;

    if (!targetPool.has(assignment.factId)) {
      targetPool.set(assignment.factId, {
        id: assignment.factId,
        category: assignment.category,
        text: assignment.card,
        kind: assignment.factKind,
        correction: assignment.factCorrection,
        metadata: assignment.factMetadata
      });
    }
  }

  room.round.revealed = true;
  room.round.result = {
    votes: { ...room.round.votes },
    voteCounts,
    imposters,
    correctAnswer: room.round.correctAnswer,
    cards: Object.fromEntries(
      Object.entries(room.round.assignments).map(([playerId, assignment]) => [playerId, { ...assignment }])
    ),
    facts: {
      real: [...realFacts.values()],
      fake: [...fakeFacts.values()]
    }
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

function startFactOrFakeRound(room: RoomRecord, players: PlayerRecord[]): void {
  const impostersToAssign = clampImposters(room, room.settings.imposters);
  room.settings.imposters = impostersToAssign;

  const playerIds = shuffle(players.map((player) => player.id));
  const recentFactIds = new Set(room.round?.usedFactIds ?? []);
  const imposterIds = new Set(playerIds.slice(0, impostersToAssign));
  const truthPlayerIds = playerIds.filter((playerId) => !imposterIds.has(playerId));
  const factsForRound = pickFactsForRound(
    room.gameId,
    room.settings.language,
    truthPlayerIds.length,
    impostersToAssign,
    recentFactIds
  );
  const realFactQueue = shuffle(factsForRound.realFacts);
  const fakeFactQueue = shuffle(factsForRound.fakeFacts);
  const assignments: Record<string, AssignmentRecord> = {};

  for (const playerId of playerIds) {
    const isImposter = imposterIds.has(playerId);
    const fact = isImposter ? fakeFactQueue.pop() : realFactQueue.pop();

    if (!fact) {
      throw new AppError(500, "Fact dealing failed due to insufficient prepared cards.");
    }

    assignments[playerId] = {
      role: isImposter ? "imposter" : "truth",
      card: fact.text,
      factId: fact.id,
      category: fact.category,
      factKind: fact.kind,
      factCorrection: fact.correction,
      factMetadata: fact.metadata
    };
  }

  room.round = {
    roundNumber: (room.round?.roundNumber ?? 0) + 1,
    usedFactIds: [...factsForRound.realFacts, ...factsForRound.fakeFacts].map((fact) => fact.id),
    assignments,
    swapsUsed: Object.fromEntries(playerIds.map((playerId) => [playerId, 0])),
    discussionEndsAt: Date.now() + room.settings.discussionMinutes * 60_000,
    votes: {},
    correctAnswer: null,
    revealed: false,
    result: null
  };
  room.phase = "discussion";
}

function startTrueOrFalseRound(room: RoomRecord, players: PlayerRecord[]): void {
  const facts = getFactsForGame(room.gameId, room.settings.language);
  const candidates = [...facts.realFacts, ...facts.fakeFacts];

  if (candidates.length === 0) {
    throw new AppError(500, "No facts configured for True or False.");
  }

  const recentFactIds = new Set(room.round?.usedFactIds ?? []);
  const freshCandidates = candidates.filter((card) => !recentFactIds.has(card.id));
  const sourcePool = freshCandidates.length > 0 ? freshCandidates : candidates;
  const pickedFact = shuffle(sourcePool)[0];

  if (!pickedFact) {
    throw new AppError(500, "Could not pick a fact for this round.");
  }

  const playerIds = players.map((player) => player.id);
  const assignments: Record<string, AssignmentRecord> = {};

  for (const playerId of playerIds) {
    assignments[playerId] = {
      role: "truth",
      card: pickedFact.text,
      factId: pickedFact.id,
      category: pickedFact.category,
      factKind: pickedFact.kind,
      factCorrection: pickedFact.correction,
      factMetadata: pickedFact.metadata
    };
  }

  room.round = {
    roundNumber: (room.round?.roundNumber ?? 0) + 1,
    usedFactIds: [pickedFact.id],
    assignments,
    swapsUsed: Object.fromEntries(playerIds.map((playerId) => [playerId, 0])),
    discussionEndsAt: 0,
    votes: {},
    correctAnswer: pickedFact.kind === "real" ? "true" : "false",
    revealed: false,
    result: null
  };
  room.phase = "voting";
}

function startRound(room: RoomRecord): void {
  const players = toSortedPlayers(room);
  const minPlayers = minPlayersForRoom(room);

  if (players.length < minPlayers) {
    throw new AppError(409, `At least ${minPlayers} players are required to start.`);
  }

  if (room.gameId === "true-or-false") {
    startTrueOrFalseRound(room, players);
  } else {
    startFactOrFakeRound(room, players);
  }

  markUpdated(room);
}

function endDiscussion(room: RoomRecord): void {
  if (!room.round || room.phase !== "discussion") {
    throw new AppError(409, "Discussion is not active.");
  }

  if (room.gameId !== "fact-or-fake") {
    throw new AppError(409, "Discussion controls are only available in Fact or Fake.");
  }

  room.phase = "voting";
  markUpdated(room);
}

function extendDiscussion(room: RoomRecord, seconds: number): void {
  if (!room.round || room.phase !== "discussion") {
    throw new AppError(409, "Discussion is not active.");
  }

  if (room.gameId !== "fact-or-fake") {
    throw new AppError(409, "Discussion controls are only available in Fact or Fake.");
  }

  const safeSeconds = normalizeExtendSeconds(seconds);
  room.round.discussionEndsAt += safeSeconds * 1000;
  markUpdated(room);
}

function requireHost(room: RoomRecord, sessionId: string): void {
  if (room.hostId !== sessionId) {
    throw new AppError(403, "Only the room host can perform this action.");
  }
}

function ensurePlayerInRoom(room: RoomRecord, sessionId: string): PlayerRecord {
  const player = room.players[sessionId];

  if (!player) {
    throw new AppError(403, "You are not in this room.");
  }

  return player;
}

function updateSettings(
  room: RoomRecord,
  sessionId: string,
  discussionMinutes: number,
  imposters: number,
  language: RoomRecord["settings"]["language"]
): void {
  requireHost(room, sessionId);

  if (room.phase !== "lobby") {
    throw new AppError(409, "Settings can only be changed in the lobby.");
  }

  const nextDiscussionMinutes = clampDiscussionMinutes(discussionMinutes);
  const nextImposters = clampImposters(room, imposters);
  const nextLanguage = normalizeLanguage(language);

  if (
    nextDiscussionMinutes !== room.settings.discussionMinutes ||
    nextImposters !== room.settings.imposters ||
    nextLanguage !== room.settings.language
  ) {
    room.settings.discussionMinutes = nextDiscussionMinutes;
    room.settings.imposters = nextImposters;
    room.settings.language = nextLanguage;
    markUpdated(room);
  }
}

function swapCard(room: RoomRecord, sessionId: string): void {
  if (room.gameId !== "fact-or-fake") {
    throw new AppError(409, "Card swap is only available in Fact or Fake.");
  }

  if (!room.round || room.phase !== "discussion") {
    throw new AppError(409, "Card swap is only available during discussion.");
  }

  const assignment = room.round.assignments[sessionId];

  if (!assignment) {
    throw new AppError(403, "You are not assigned in this round.");
  }

  const usedSwaps = room.round.swapsUsed[sessionId] ?? 0;

  if (usedSwaps >= SWAP_LIMIT_PER_ROUND) {
    throw new AppError(409, `Swap limit reached. Maximum ${SWAP_LIMIT_PER_ROUND} swaps per round.`);
  }

  const deck = getFactsForGame(room.gameId, room.settings.language);
  const sourcePool = assignment.factKind === "fake" ? deck.fakeFacts : deck.realFacts;
  const conflictKeys = collectConflictKeysFromAssignments(room.round.assignments, sessionId);
  const compatiblePool = sourcePool.filter(
    (fact) => !conflictsWithOppositeSide(fact, assignment.factKind, conflictKeys)
  );
  const assignedFactIds = new Set(Object.values(room.round.assignments).map((item) => item.factId));
  const usedFactIds = new Set(room.round.usedFactIds);
  const effectivePool = compatiblePool.filter((fact) => !assignedFactIds.has(fact.id) && !usedFactIds.has(fact.id));
  const nextCard = shuffle(effectivePool)[0];

  if (!nextCard) {
    throw new AppError(409, "No additional cards are available for swap right now.");
  }

  assignment.card = nextCard.text;
  assignment.factId = nextCard.id;
  assignment.category = nextCard.category;
  assignment.factKind = nextCard.kind;
  assignment.factCorrection = nextCard.correction;
  assignment.factMetadata = nextCard.metadata;
  room.round.usedFactIds.push(nextCard.id);
  room.round.swapsUsed[sessionId] = usedSwaps + 1;
  markUpdated(room);
}

function castVote(room: RoomRecord, sessionId: string, targetPlayerId: string): void {
  if (room.gameId !== "fact-or-fake") {
    throw new AppError(409, "Use True/False answers in this game mode.");
  }

  if (!room.round || room.phase !== "voting") {
    throw new AppError(409, "Voting is not active.");
  }

  if (!room.players[targetPlayerId]) {
    throw new AppError(404, "Vote target not found.");
  }

  if (targetPlayerId === sessionId) {
    throw new AppError(409, "You cannot vote for yourself.");
  }

  room.round.votes[sessionId] = targetPlayerId;

  if (haveAllPlayersVoted(room)) {
    finalizeRound(room);
    return;
  }

  markUpdated(room);
}

function answerTrueFalse(room: RoomRecord, sessionId: string, answer: TrueFalseAnswer): void {
  if (room.gameId !== "true-or-false") {
    throw new AppError(409, "True/False answers are only available in this game mode.");
  }

  if (!room.round || room.phase !== "voting") {
    throw new AppError(409, "Answering is not active.");
  }

  room.round.votes[sessionId] = answer;

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

  if (room.phase !== "lobby" && remainingPlayers.length < minPlayersForRoom(room)) {
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

function buildClosedRoomView(code: string, gameId: RoomRecord["gameId"] = "fact-or-fake"): RoomView {
  const minPlayers = getGame(gameId)?.minPlayers ?? MIN_PLAYERS;

  return {
    joined: false,
    roomCode: code,
    gameId,
    language: "en",
    version: 0,
    phase: "lobby",
    settings: { ...DEFAULT_SETTINGS },
    minPlayers,
    players: [],
    hostId: null,
    meId: null,
    canStart: false,
    requiresPassword: false,
    round: null,
    message: "This room has closed."
  };
}

export function buildRoomView(room: RoomRecord, sessionId: string): RoomView {
  const players = toSortedPlayers(room);
  const me = room.players[sessionId] ?? null;
  const minPlayers = minPlayersForRoom(room);

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
      language: room.settings.language,
      version: room.version,
      phase: room.phase,
      settings: room.settings,
      minPlayers,
      players: publicPlayers,
      hostId: room.hostId,
      meId: null,
      canStart: false,
      requiresPassword: Boolean(room.password),
      round: null,
      message:
        room.phase === "lobby"
          ? "Enter your name to join this room."
          : "A round is in progress. Join when the lobby opens."
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
      mySwapsRemaining:
        room.gameId === "fact-or-fake"
          ? Math.max(0, SWAP_LIMIT_PER_ROUND - (room.round.swapsUsed[sessionId] ?? 0))
          : 0,
      myVote: room.round.votes[sessionId] ?? null,
      myAnswer:
        room.gameId === "true-or-false" && (room.round.votes[sessionId] === "true" || room.round.votes[sessionId] === "false")
          ? (room.round.votes[sessionId] as TrueFalseAnswer)
          : null,
      correctAnswer: room.phase === "results" ? result?.correctAnswer ?? null : null,
      imposters: room.phase === "results" ? result?.imposters ?? null : null,
      votes: room.phase === "results" ? result?.votes ?? null : null,
      voteCounts: room.phase === "results" ? result?.voteCounts ?? null : null,
      cards: room.phase === "results" ? result?.cards ?? null : null,
      facts: room.phase === "results" ? result?.facts ?? null : null
    };
  }

  const hostControlsStart = room.hostId === sessionId && room.phase === "lobby" && players.length >= minPlayers;
  const message =
    room.phase === "lobby" && players.length < minPlayers
      ? `At least ${minPlayers} players are required to start.`
      : null;

  return {
    joined: true,
    roomCode: room.code,
    gameId: room.gameId,
    language: room.settings.language,
    version: room.version,
    phase: room.phase,
    settings: room.settings,
    minPlayers,
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
    throw new AppError(400, "Display name is required.");
  }

  const game = getGame(input.gameId);

  if (!game) {
    throw new AppError(404, "Game not found.");
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
    throw new AppError(500, "Unable to allocate a room code. Try again.");
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
    settings: {
      ...DEFAULT_SETTINGS,
      language: normalizeLanguage(input.language)
    },
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
    throw new AppError(400, "Display name is required.");
  }

  const roomCode = normalizeRoomCode(input.roomCode);

  if (!roomCode) {
    throw new AppError(400, "Room code is required.");
  }

  const store = getRoomStore();
  const room = await store.getRoom(roomCode);

  if (!room) {
    throw new AppError(404, "Room not found.");
  }

  const password = sanitizePassword(input.password);

  if (room.password && room.password !== password) {
    throw new AppError(403, "Incorrect room password.");
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
    throw new AppError(409, "Round already in progress. Join after results.");
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
    throw new AppError(400, "Room code is required.");
  }

  const store = getRoomStore();
  const room = await store.getRoom(code);

  if (!room) {
    throw new AppError(404, "Room not found.");
  }

  let changed = applyAutomaticTransitions(room);

  if (input.action.type !== "leave_room") {
    ensurePlayerInRoom(room, sessionId);
  }

  switch (input.action.type) {
    case "update_settings": {
      const previousVersion = room.version;
      updateSettings(
        room,
        sessionId,
        input.action.discussionMinutes,
        input.action.imposters,
        input.action.language
      );
      changed = changed || room.version !== previousVersion;
      break;
    }
    case "start_round": {
      requireHost(room, sessionId);

      if (room.phase !== "lobby") {
        throw new AppError(409, "You can only start from the lobby.");
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
    case "answer_true_false": {
      ensurePlayerInRoom(room, sessionId);
      const previousVersion = room.version;
      answerTrueFalse(room, sessionId, input.action.answer);
      changed = changed || room.version !== previousVersion;
      break;
    }
    case "reveal_results": {
      requireHost(room, sessionId);

      if (room.phase !== "voting") {
        throw new AppError(409, "Results can only be revealed during voting.");
      }

      finalizeRound(room);
      changed = true;
      break;
    }
    case "swap_card": {
      ensurePlayerInRoom(room, sessionId);
      const previousVersion = room.version;
      swapCard(room, sessionId);
      changed = changed || room.version !== previousVersion;
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
        throw new AppError(409, "Finish the current round first.");
      }

      startRound(room);
      changed = true;
      break;
    }
    case "back_to_lobby": {
      requireHost(room, sessionId);

      if (room.phase !== "results") {
        throw new AppError(409, "You can only return to lobby after results.");
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
        return buildClosedRoomView(room.code, room.gameId);
      }

      changed = true;
      break;
    }
    default:
      throw new AppError(400, "Unsupported action.");
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
    throw new AppError(400, "Room code is required.");
  }

  const store = getRoomStore();
  const startedAt = Date.now();

  while (Date.now() - startedAt < LONG_POLL_TIMEOUT_MS) {
    const room = await store.getRoom(code);

    if (!room) {
      throw new AppError(404, "Room not found.");
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
    throw new AppError(404, "Room not found.");
  }

  return buildRoomView(room, memberSessionId);
}
