import { NextResponse } from "next/server";

import { joinRoom } from "@/lib/server/engine";
import { toErrorResponse } from "@/lib/server/http";
import type { JoinRoomInput } from "@/lib/shared/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as JoinRoomInput;
    const state = await joinRoom(payload);

    return NextResponse.json({ state });
  } catch (error) {
    return toErrorResponse(error);
  }
}
