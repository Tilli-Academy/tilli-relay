import { NextResponse } from "next/server";
import { destroySession, setSessionCookie } from "@/lib/auth";

export async function POST() {
  const clearCookie = await destroySession();
  const response = NextResponse.json({ ok: true });
  return setSessionCookie(response, clearCookie);
}
