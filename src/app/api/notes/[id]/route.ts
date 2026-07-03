import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const UPDATE_FIELDS = [
  "folderId",
  "title",
  "content",
  "type",
  "color",
  "pinned",
  "imageData",
  "audioData",
] as const;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: Prisma.NoteUpdateInput = {};

  for (const key of UPDATE_FIELDS) {
    if (!(key in body)) continue;
    const value = body[key];

    if (key === "folderId") {
      if (value === null || value === undefined || value === "") {
        data.folder = { disconnect: true };
      } else if (typeof value === "string") {
        data.folder = { connect: { id: value } };
      }
    } else if (key === "title") {
      data.title = typeof value === "string" ? value : "";
    } else if (key === "content") {
      data.content = typeof value === "string" ? value : "";
    } else if (key === "type") {
      data.type = typeof value === "string" ? value : "text";
    } else if (key === "color") {
      data.color = typeof value === "string" ? value : "#fef3c7";
    } else if (key === "pinned") {
      data.pinned = Boolean(value);
    } else if (key === "imageData") {
      data.imageData = typeof value === "string" ? value : null;
    } else if (key === "audioData") {
      data.audioData = typeof value === "string" ? value : null;
    }
  }

  try {
    const note = await db.note.update({ where: { id }, data });
    return NextResponse.json(note);
  } catch {
    return NextResponse.json(
      { error: "Note not found or update failed" },
      { status: 404 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await db.note.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Note not found or already deleted" },
      { status: 404 }
    );
  }
}
