import { NextResponse } from "next/server";

import { AppError } from "@/lib/server/errors";

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: "Неизвестная ошибка сервера." }, { status: 500 });
}
