import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/transactions
// Optional query: ?type=income|expense  ?account=<name>
// Always ordered by date desc.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const account = searchParams.get("account");

  const where: { type?: string; account?: string } = {};
  if (type === "income" || type === "expense") where.type = type;
  if (account && account.trim()) where.account = account.trim();

  const items = await db.transaction.findMany({
    where,
    orderBy: { date: "desc" },
  });

  // Serialize dates as ISO strings for the client.
  return NextResponse.json(
    items.map((t) => ({
      ...t,
      date: t.date.toISOString(),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }))
  );
}

// POST /api/transactions
// Body: { type, account, amount, description, category, date, imageData? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const type = body.type === "income" ? "income" : "expense";
  const account =
    typeof body.account === "string" && body.account.trim()
      ? body.account.trim()
      : "Cash";
  const amount = Number(body.amount);
  const description = typeof body.description === "string" ? body.description : "";
  const category =
    typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : "General";
  const imageData =
    typeof body.imageData === "string" && body.imageData.startsWith("data:")
      ? body.imageData
      : null;
  const date = body.date ? new Date(body.date) : new Date();

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive number" },
      { status: 400 }
    );
  }

  const created = await db.transaction.create({
    data: { type, account, amount, description, category, imageData, date },
  });

  return NextResponse.json(
    {
      ...created,
      date: created.date.toISOString(),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
