import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// PUT /api/transactions/[id] — update any subset of fields.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: {
    type?: string;
    account?: string;
    amount?: number;
    description?: string;
    category?: string;
    imageData?: string | null;
    imageData2?: string | null;
    date?: Date;
  } = {};

  if (body.type === "income" || body.type === "expense") data.type = body.type;
  if (typeof body.account === "string" && body.account.trim()) {
    data.account = body.account.trim();
  }
  if (body.amount !== undefined && body.amount !== null) {
    const n = Number(body.amount);
    if (Number.isFinite(n)) data.amount = n;
  }
  if (typeof body.description === "string") data.description = body.description;
  if (typeof body.category === "string" && body.category.trim()) {
    data.category = body.category.trim();
  }
  // imageData: accept a data URL string, or null to clear it
  if (body.imageData === null) {
    data.imageData = null;
  } else if (
    typeof body.imageData === "string" &&
    body.imageData.startsWith("data:")
  ) {
    data.imageData = body.imageData;
  }
  // imageData2: accept a data URL string, or null to clear it
  if (body.imageData2 === null) {
    data.imageData2 = null;
  } else if (
    typeof body.imageData2 === "string" &&
    body.imageData2.startsWith("data:")
  ) {
    data.imageData2 = body.imageData2;
  }
  if (body.date) {
    const d = new Date(body.date);
    if (!Number.isNaN(d.getTime())) data.date = d;
  }

  const updated = await db.transaction.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    ...updated,
    date: updated.date.toISOString(),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

// DELETE /api/transactions/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.transaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
