# Deployment Guide — GitHub + Vercel + Neon

This app (Notes · Files · Finance manager) is production-ready for deployment on
**GitHub** (source) → **Vercel** (hosting) → **Neon** (PostgreSQL database).

---

## Architecture

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Database**: PostgreSQL on Neon (was SQLite in dev)
- **ORM**: Prisma 6
- **Hosting**: Vercel (serverless functions)
- **Storage**: Receipt images / file uploads are stored as base64 data URLs in
  the database (TEXT columns). For a personal-scale app this is fine; for higher
  volume, switch to blob storage (Vercel Blob / S3) later.

---

## Step 1 — Create a Neon database

1. Go to <https://neon.tech> and sign in.
2. **New Project** → name it (e.g. `organize-app`) → pick a region close to
   Vercel's (default `aws-us-east-1` is fine).
3. Once created, open **Connection Details**. Neon shows two connection strings:
   - **Pooled connection** (uses `-pooler` in the host) → use as `DATABASE_URL`
   - **Direct connection** (no `-pooler`) → use as `DIRECT_URL`
4. Copy both strings. They look like:
   ```
   postgresql://neondb_owner:PASSWORD@ep-cool-name-pooler.us-east-2.aws.neon.tech/organize?sslmode=require
   postgresql://neondb_owner:PASSWORD@ep-cool-name.us-east-2.aws.neon.tech/organize?sslmode=require
   ```

> Keep these handy — you'll paste them into Vercel in Step 3.

---

## Step 2 — Push the code to GitHub

1. Create a new (empty) repository on GitHub, e.g. `organize-app`. Do **not**
   add a README or .gitignore (the repo already has one).
2. From the project root:
   ```bash
   git init
   git add .
   git commit -m "Production-ready: Notes, Files & Finance app"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USER>/organize-app.git
   git push -u origin main
   ```

> `.env` is gitignored, so your database credentials never go to GitHub.
> `.env.example` is committed as a template.

---

## Step 3 — Deploy to Vercel

1. Go to <https://vercel.com> → **Add New… → Project**.
2. **Import** the `organize-app` repository from GitHub.
3. Vercel auto-detects Next.js. Leave the defaults:
   - **Build Command**: `next build` (the `postinstall` script runs
     `prisma generate` automatically)
   - **Output Directory**: `.next`
4. Open **Environment Variables** and add:
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | Neon **pooled** connection string (`...-pooler...?sslmode=require`) |
   | `DIRECT_URL`   | Neon **direct** connection string (`...?sslmode=require`) |
5. Click **Deploy**. The first build takes ~2–3 minutes.

> Vercel's build runs `prisma generate` (via `postinstall`) so the Prisma Client
> is available to the serverless functions.

---

## Step 4 — Create the database tables

After the first deploy, create the tables on Neon. You have two options:

### Option A — from your local machine (recommended)
```bash
# put your real Neon strings in .env first (DATABASE_URL + DIRECT_URL)
bun install
bun run db:push        # creates all tables on Neon
```

### Option B — via Prisma migrate (for versioned migrations)
```bash
bun run db:migrate:deploy
```

> `db:push` is simplest — it syncs the schema to Neon without migration files.
> Use `migrate` if you want a migration history.

---

## Step 5 — Verify

1. Open the Vercel deployment URL.
2. The app loads with empty Notes / Files / Finance tabs.
3. Add a note → it should persist (refresh to confirm).
4. Add an income/expense → confirm it appears in the grid.

If you see a database error, double-check that `DATABASE_URL` and `DIRECT_URL`
are set correctly in **Vercel → Settings → Environment Variables** and that you
ran `db:push` once.

---

## Environment variables summary

| Variable | Where | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | Vercel + .env | Neon pooled connection (runtime queries) |
| `DIRECT_URL` | Vercel + .env | Neon direct connection (Prisma migrations/push) |

---

## Local development with Neon

To run the app locally against the Neon database (instead of the old SQLite):

1. Put your Neon strings in `.env`:
   ```
   DATABASE_URL="postgresql://...-pooler...?sslmode=require"
   DIRECT_URL="postgresql://...?sslmode=require"
   ```
2. `bun install`
3. `bun run db:push` (only needed once)
4. `bun run dev`

> The old SQLite database (`db/custom.db`) is no longer used. The schema now
> requires PostgreSQL.

---

## Notes / troubleshooting

- **Build fails on `prisma generate`**: ensure `prisma` and `@prisma/client`
  are in `dependencies` (they are). Vercel runs `postinstall` automatically.
- **`DATABASE_URL` cannot be reached**: Neon pauses idle databases after ~5 min
  on the free tier. The first request after pause may be slow (~1s) while it
  resumes. This is normal.
- **Large images**: receipt photos are stored as base64 in PostgreSQL. Keep
  images under ~2 MB each to avoid slow uploads. The app allows up to 10 MB per
  request (`bodySizeLimit` in `next.config.ts`).
- **Connection pooling**: always use the **pooled** string (`-pooler`) for
  `DATABASE_URL` on Vercel serverless — this prevents exhausting connections.
  Use the **direct** string for `DIRECT_URL` (migrations only).
