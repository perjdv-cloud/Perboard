import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/files/:id — single file
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const file = await db.fileItem.findUnique({ where: { id } });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json(file);
  } catch (err) {
    console.error("[files/:id] GET error", err);
    return NextResponse.json(
      { error: "Failed to load file" },
      { status: 500 }
    );
  }
}

// DELETE /api/files/:id — delete file
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.fileItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    await db.fileItem.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[files/:id] DELETE error", err);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
