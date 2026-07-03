import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/files?folderId=<id|null> — list files
// - No folderId: returns all files
// - folderId=<id>: returns files in that folder
// - folderId=null (literal string "null"): returns unfiled files
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const folderIdRaw = url.searchParams.get("folderId");

    const where =
      folderIdRaw === null
        ? undefined
        : folderIdRaw === "null"
        ? { folderId: null }
        : { folderId: folderIdRaw };

    const files = await db.fileItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(files);
  } catch (err) {
    console.error("[files] GET error", err);
    return NextResponse.json(
      { error: "Failed to load files" },
      { status: 500 }
    );
  }
}

// POST /api/files — create file {folderId?, name, type, mimeType, data, size}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "File name is required" },
        { status: 400 }
      );
    }
    if (typeof body.data !== "string" || !body.data.startsWith("data:")) {
      return NextResponse.json(
        { error: "File data (base64 data URL) is required" },
        { status: 400 }
      );
    }

    const allowedTypes = ["image", "document", "pdf", "excel"];
    const type =
      typeof body.type === "string" && allowedTypes.includes(body.type)
        ? body.type
        : "document";

    const file = await db.fileItem.create({
      data: {
        folderId:
          typeof body.folderId === "string" && body.folderId.length > 0
            ? body.folderId
            : null,
        name: body.name.trim().slice(0, 200),
        type,
        mimeType:
          typeof body.mimeType === "string" ? body.mimeType : "",
        data: body.data,
        size:
          typeof body.size === "number" && body.size >= 0
            ? Math.floor(body.size)
            : 0,
      },
    });
    return NextResponse.json(file, { status: 201 });
  } catch (err) {
    console.error("[files] POST error", err);
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 }
    );
  }
}
