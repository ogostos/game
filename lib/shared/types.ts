export type GameId = "fact-or-fake" | "true-or-false";
export type Language = "en" | "ru";

export type RoomPhase = "lobby" | "discussion" | "voting" | "results";

export type PlayerRole = "truth" | "imposter";
export type FactKind = "real" | "fake";
export type TrueFalseAnswer = "true" | "false";
export type FactQualityTier = "curated" | "generated";
export type FactSourceType = "manual_seed" | "book_extract" | "wikidata" | "wikipedia" | "reference_site";
export type FactVerificationStatus = "draft" | "verified";

export interface FactSourceReference {
  name: string;
  url: string;
}

export interface FactCardMetadata {
  qualityTier: FactQualityTier;
  sourceType: FactSourceType;
  verificationStatus: FactVerificationStatus;
  familyFriendly: boolean;
  reviewedAt: string;
  verifiedAt?: string;
  source?: FactSourceReference;
  tags: string[];
  notes?: string;
}

export interface RoomSettings {
  discussionMinutes: number;
  imposters: number;
  language: Language;
}

export interface GameSummary {
  id: GameId;
  title: string;
  description: string;
  minPlayers: number;
  maxImposters: number;
  supportsImposters: boolean;
  factCount: number;
}

export interface FactCard {
  id: string;
  category: string;
  text: string;
  kind: FactKind;
  correction: string | null;
  metadata: FactCardMetadata;
}

export interface FactDeck {
  realFacts: FactCard[];
  fakeFacts: FactCard[];
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
  factId: string;
  category: string;
  factKind: FactKind;
  factCorrection: string | null;
  factMetadata: FactCardMetadata;
}

export interface RoundFactsSummary {
  real: FactCard[];
  fake: FactCard[];
}

export interface RoundResult {
  votes: Record<string, string>;
  voteCounts: Record<string, number>;
  imposters: string[];
  correctAnswer: TrueFalseAnswer | null;
  cards: Record<string, AssignmentRecord>;
  facts: RoundFactsSummary;
}

export interface RoundRecord {
  roundNumber: number;
  usedFactIds: string[];
  assignments: Record<string, AssignmentRecord>;
  swapsUsed: Record<string, number>;
  discussionEndsAt: number;
  votes: Record<string, string>;
  correctAnswer: TrueFalseAnswer | null;
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
  mySwapsRemaining: number;
  myVote: string | null;
  myAnswer: TrueFalseAnswer | null;
  correctAnswer: TrueFalseAnswer | null;
  imposters: string[] | null;
  votes: Record<string, string> | null;
  voteCounts: Record<string, number> | null;
  cards: Record<string, AssignmentRecord> | null;
  facts: RoundFactsSummary | null;
}

export interface RoomView {
  joined: boolean;
  roomCode: string;
  gameId: GameId;
  language: Language;
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
      language: Language;
    }
  | {
      type: "start_round";
    }
  | {
      type: "cast_vote";
      targetPlayerId: string;
    }
  | {
      type: "answer_true_false";
      answer: TrueFalseAnswer;
    }
  | {
      type: "reveal_results";
    }
  | {
      type: "swap_card";
    }
  | {
      type: "end_discussion";
    }
  | {
      type: "extend_discussion";
      seconds: number;
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
  language?: Language;
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
  imposters: 1,
  language: "en"
};

export const MIN_PLAYERS = 3;
export const MIN_DISCUSSION_MINUTES = 1;
export const MAX_DISCUSSION_MINUTES = 5;
export const MAX_NAME_LENGTH = 24;
export const SWAP_LIMIT_PER_ROUND = 2;
