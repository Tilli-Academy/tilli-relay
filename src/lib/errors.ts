import { NextResponse } from "next/server";

export class AppError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AppError";
  }
}

/** Convert an AppError (or unknown throw) into a JSON NextResponse. */
export function handleAppError(e: unknown): NextResponse {
  if (e instanceof AppError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
