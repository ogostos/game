import { NextResponse } from "next/server";

import { syncRoomView } from "@/lib/server/engine";
import { AppError } from "@/lib/server/errors";
import { toErrorResponse } from "@/lib/server/http";

export const runtime = "nodejs";

interface ParamsContext {
  params: Promise<{ code: string }>;
}

export async function GET(request: Request, context: ParamsContext) {
  try {
    const { code } = await context.params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId") ?? "";
    const since = Number(searchParams.get("since") ?? "0");

    if (!Number.isFinite(since)) {
      throw new AppError(400, "Invalid version number.");
    }

    const state = await syncRoomView(code, sessionId, Math.max(0, Math.floor(since)));

    return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
