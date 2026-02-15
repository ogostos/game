import { NextResponse } from "next/server";

import { createRoom } from "@/lib/server/engine";
import { toErrorResponse } from "@/lib/server/http";
import type { CreateRoomInput } from "@/lib/shared/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateRoomInput;
    const state = await createRoom(payload);

    return NextResponse.json({ state });
  } catch (error) {
    return toErrorResponse(error);
  }
}
