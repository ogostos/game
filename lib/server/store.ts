import { Redis } from "@upstash/redis";

import type { RoomRecord } from "@/lib/shared/types";

export interface RoomStore {
  getRoom(code: string): Promise<RoomRecord | null>;
  setRoom(room: RoomRecord): Promise<void>;
  deleteRoom(code: string): Promise<void>;
}

class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, RoomRecord>();

  async getRoom(code: string): Promise<RoomRecord | null> {
    return this.rooms.get(code) ?? null;
  }

  async setRoom(room: RoomRecord): Promise<void> {
    this.rooms.set(room.code, room);
  }

  async deleteRoom(code: string): Promise<void> {
    this.rooms.delete(code);
  }
}

class RedisRoomStore implements RoomStore {
  private readonly redis: Redis;

  constructor() {
    this.redis = Redis.fromEnv();
  }

  private key(code: string): string {
    return `room:${code}`;
  }

  async getRoom(code: string): Promise<RoomRecord | null> {
    const payload = await this.redis.get<RoomRecord>(this.key(code));
    return payload ?? null;
  }

  async setRoom(room: RoomRecord): Promise<void> {
    await this.redis.set(this.key(room.code), room);
  }

  async deleteRoom(code: string): Promise<void> {
    await this.redis.del(this.key(code));
  }
}

function shouldUseRedis(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

declare global {
  var __imposterRoomStore: RoomStore | undefined;
}

export function getRoomStore(): RoomStore {
  if (!globalThis.__imposterRoomStore) {
    globalThis.__imposterRoomStore = shouldUseRedis() ? new RedisRoomStore() : new MemoryRoomStore();
  }

  return globalThis.__imposterRoomStore;
}
