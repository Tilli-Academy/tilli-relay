import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import { UPLOAD_DIR, MAX_FILE_SIZE } from "@/lib/upload";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File exceeds maximum size of ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB` },
      { status: 400 }
    );
  }

  // Sanitize original filename
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255);
  const fileId = randomUUID();
  const userDir = path.join(UPLOAD_DIR, session.userId);
  const filePath = path.join(userDir, `${fileId}-${safeName}`);

  try {
    if (!existsSync(userDir)) {
      await mkdir(userDir, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return NextResponse.json({
      fileId,
      filePath,
      fileName: file.name,
      size: file.size,
    });
  } catch (err) {
    console.error("[POST /api/upload]", err);
    return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
  }
}
