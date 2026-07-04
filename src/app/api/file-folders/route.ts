import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/file-folders — list all folders
export async function GET() {
  try {
    const folders = await db.fileFolder.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { files: true } } },
    });
    return NextResponse.json(folders);
  } catch (err) {
    console.error("[file-folders] GET error", err);
    return NextResponse.json(
      { error: "Failed to load folders" },
      { status: 500 }
    );
  }
}

// POST /api/file-folders — create a folder {name, color?}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }
    const color =
      typeof body.color === "string" && body.color.trim()
        ? body.color.trim()
        : "#bfdbfe";
    const folder = await db.fileFolder.create({
      data: { name: body.name.trim().slice(0, 60), color },
    });
    return NextResponse.json(folder, { status: 201 });
  } catch (err) {
    console.error("[file-folders] POST error", err);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
