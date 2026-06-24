import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  return destroySession(response);
}
