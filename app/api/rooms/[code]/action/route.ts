import { NextResponse } from "next/server";

import { performAction } from "@/lib/server/engine";
import { toErrorResponse } from "@/lib/server/http";
import type { ActionInput } from "@/lib/shared/types";

export const runtime = "nodejs";

interface ParamsContext {
  params: Promise<{ code: string }>;
}

export async function POST(request: Request, context: ParamsContext) {
  try {
    const payload = (await request.json()) as ActionInput;
    const { code } = await context.params;
    const state = await performAction(code, payload);

    return NextResponse.json({ state });
  } catch (error) {
    return toErrorResponse(error);
  }
}
