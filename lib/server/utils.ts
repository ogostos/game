import { MAX_NAME_LENGTH } from "@/lib/shared/types";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 5;

export function normalizeRoomCode(roomCode: string): string {
  return roomCode.trim().toUpperCase();
}

export function generateRoomCode(): string {
  let value = "";

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const charIndex = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    value += ROOM_CODE_ALPHABET[charIndex];
  }

  return value;
}

export function sanitizeDisplayName(rawValue: string): string {
  const value = rawValue.trim();

  if (!value) {
    return "";
  }

  return value.slice(0, MAX_NAME_LENGTH);
}

export function sanitizePassword(rawValue?: string): string | undefined {
  if (!rawValue) {
    return undefined;
  }

  const value = rawValue.trim();
  return value.length > 0 ? value : undefined;
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
