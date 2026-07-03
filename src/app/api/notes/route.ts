import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { NOTE_COLORS } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/notes?folderId=<id|null>  — optionally filter by folder
// We always return notes ordered by updatedAt desc; client-side handles
// further filtering (search) and re-sorting.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const folderIdParam = searchParams.get("folderId");

  const where: Prisma.NoteWhereInput = {};
  if (folderIdParam === "null") {
    where.folderId = null;
  } else if (folderIdParam && folderIdParam !== "all") {
    where.folderId = folderIdParam;
  }

  const notes = await db.note.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const data: Prisma.NoteCreateInput = {
    title: typeof body.title === "string" ? body.title : "",
    content: typeof body.content === "string" ? body.content : "",
    type: typeof body.type === "string" ? body.type : "text",
    color:
      typeof body.color === "string" && body.color
        ? body.color
        : NOTE_COLORS[0],
    pinned: typeof body.pinned === "boolean" ? body.pinned : false,
    imageData: typeof body.imageData === "string" ? body.imageData : null,
    audioData: typeof body.audioData === "string" ? body.audioData : null,
  };

  // Folder link
  if (body.folderId && typeof body.folderId === "string") {
    data.folder = { connect: { id: body.folderId } };
  }

  const note = await db.note.create({ data });
  return NextResponse.json(note, { status: 201 });
}
