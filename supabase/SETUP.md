# Supabase setup (steps 1 → 2 → 3)

## 1 — Create the Supabase project (cloud)

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. **New project** → choose organization, name (e.g. `swarai`), **Region** (Mumbai `ap-south-1` if you want India proximity).
3. Set a database password and wait until the project is **healthy**.
4. In **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **`anon` `public`** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. In **Project Settings → API**, copy **`service_role`** (secret) → `SUPABASE_SERVICE_ROLE_KEY` (server only, never in the browser).

## 2 — Apply this repo’s schema to that project

**Option A — Supabase CLI (recommended)**

```bash
cd /path/to/SwarAI
pnpm run supabase:login    # browser auth
pnpm run supabase:link     # paste project ref from Dashboard → Settings → General
pnpm run supabase:push     # runs all files in supabase/migrations/ in order
```

**Option B — SQL Editor (easiest)**

1. Dashboard → **SQL Editor** → New query.
2. Open **`supabase/apply_all_migrations_one_shot.sql`** in this repo, copy **everything**, paste, **Run** once.

   Or paste each file **in order** from `supabase/migrations/` if you prefer smaller steps.

## 3 — Verify + (optional) Clerk ↔ Supabase

1. In SQL Editor, run `verify_schema.sql` — you should see the expected public tables listed.

### Do you need “Step B” (Clerk + Supabase auth)?

**For this SwarAI codebase: usually no.** The Next.js API routes check **Clerk** first, then talk to Postgres with the **Supabase service role** key. That bypasses Row Level Security (RLS) on the server, so the dashboard can work **without** linking Clerk’s tokens to Supabase.

Add **Step B** only if you want either of these later:

- Browser or edge code using the **anon** key and **RLS** with the logged-in user’s identity, or  
- Defense-in-depth so even server code uses a user-scoped JWT instead of service role.

**If you do want it:** use the official flow (it changes over time; prefer current docs):

- [Supabase: Clerk as third-party auth](https://supabase.com/docs/guides/auth/third-party/clerk)  
- [Clerk: Supabase integration](https://clerk.com/docs/integration/supabase)  
- Clerk Dashboard often has **Integrations → Supabase** with copy-paste values for Supabase.

The repo also has a helper `apps/web/src/lib/supabase/clerk-server.ts` that expects a Clerk JWT template named **`supabase`** — that path is **not wired** into the live API routes today; everything uses `createServiceClient()` instead.

Local-only dev (optional): `pnpm run supabase:start` then `pnpm run supabase:reset` — uses Docker and applies the same migrations.
