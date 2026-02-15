export type GameId = "fact-or-fake";

export type RoomPhase = "lobby" | "discussion" | "voting" | "results";

export type PlayerRole = "truth" | "imposter";

export interface RoomSettings {
  discussionMinutes: number;
  imposters: number;
}

export interface GameSummary {
  id: GameId;
  title: string;
  description: string;
  minPlayers: number;
  maxImposters: number;
}

export interface FactPair {
  id: string;
  category: string;
  realFact: string;
  fakeFact: string;
}

export interface PlayerRecord {
  id: string;
  displayName: string;
  joinedAt: number;
  score: number;
}

export interface AssignmentRecord {
  role: PlayerRole;
  card: string;
}

export interface RoundResult {
  votes: Record<string, string>;
  voteCounts: Record<string, number>;
  imposters: string[];
  cards: Record<string, AssignmentRecord>;
  realFact: string;
  fakeFact: string;
}

export interface RoundRecord {
  roundNumber: number;
  factId: string;
  realFact: string;
  fakeFact: string;
  assignments: Record<string, AssignmentRecord>;
  discussionEndsAt: number;
  votes: Record<string, string>;
  revealed: boolean;
  result: RoundResult | null;
}

export interface RoomRecord {
  code: string;
  gameId: GameId;
  hostId: string;
  password?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  phase: RoomPhase;
  settings: RoomSettings;
  players: Record<string, PlayerRecord>;
  round: RoundRecord | null;
}

export interface PublicPlayer {
  id: string;
  displayName: string;
  score: number;
  isHost: boolean;
  hasVoted: boolean;
}

export interface PublicRound {
  roundNumber: number;
  discussionEndsAt: number | null;
  myCard: string | null;
  myRole: PlayerRole | null;
  myVote: string | null;
  imposters: string[] | null;
  votes: Record<string, string> | null;
  voteCounts: Record<string, number> | null;
  cards: Record<string, AssignmentRecord> | null;
  realFact: string | null;
  fakeFact: string | null;
}

export interface RoomView {
  joined: boolean;
  roomCode: string;
  gameId: GameId;
  version: number;
  phase: RoomPhase;
  settings: RoomSettings;
  minPlayers: number;
  players: PublicPlayer[];
  hostId: string | null;
  meId: string | null;
  canStart: boolean;
  requiresPassword: boolean;
  round: PublicRound | null;
  message: string | null;
}

export type RoomAction =
  | {
      type: "update_settings";
      discussionMinutes: number;
      imposters: number;
    }
  | {
      type: "start_round";
    }
  | {
      type: "cast_vote";
      targetPlayerId: string;
    }
  | {
      type: "reveal_results";
    }
  | {
      type: "play_again";
    }
  | {
      type: "back_to_lobby";
    }
  | {
      type: "leave_room";
    };

export interface CreateRoomInput {
  sessionId: string;
  displayName: string;
  gameId: GameId;
  password?: string;
}

export interface JoinRoomInput {
  sessionId: string;
  roomCode: string;
  displayName: string;
  password?: string;
}

export interface ActionInput {
  sessionId: string;
  action: RoomAction;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  discussionMinutes: 2,
  imposters: 1
};

export const MIN_PLAYERS = 3;
export const MIN_DISCUSSION_MINUTES = 1;
export const MAX_DISCUSSION_MINUTES = 5;
export const MAX_NAME_LENGTH = 24;
