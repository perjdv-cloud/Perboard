import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { FOLDER_COLORS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await db.noteFolder.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "Folder name is required" },
      { status: 400 }
    );
  }
  const color =
    typeof body.color === "string" && body.color
      ? body.color
      : FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];

  const folder = await db.noteFolder.create({
    data: { name, color },
  });
  return NextResponse.json(folder, { status: 201 });
}
