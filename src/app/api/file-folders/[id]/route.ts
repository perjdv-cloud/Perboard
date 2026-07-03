import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// DELETE /api/file-folders/:id — delete folder; files keep folderId=null via SetNull
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.fileFolder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }
    await db.fileFolder.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[file-folders/:id] DELETE error", err);
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 }
    );
  }
}
