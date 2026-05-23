# WorkSpace

An enterprise digital workplace platform that unifies documents, project/task tracking, HR management, analytics, and team collaboration in one intranet app.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/digital-workplace run dev` — run the frontend (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed demo data into the database
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind CSS 4 + shadcn/ui + Wouter routing
- Auth: Clerk (`@clerk/react@6.x`, `@clerk/express@2.x`)
- API: Express 5 + Pino logging
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — source-of-truth DB schema (users, departments, projects, tasks, documents, hr, activity)
- `lib/api-spec/` — OpenAPI spec (source of truth for all routes)
- `lib/api-zod/src/generated/` — generated Zod schemas from OpenAPI
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/digital-workplace/src/pages/` — React page components
- `artifacts/digital-workplace/src/components/` — layout, theme-provider, shadcn/ui
- `artifacts/digital-workplace/src/index.css` — CSS variables (slate/indigo theme)
- `scripts/src/seed.ts` — demo data seed script

## Architecture decisions

- **Contract-first API**: OpenAPI spec → Orval codegen → typed React Query hooks + Zod validators. Never write fetch calls by hand.
- **Clerk for auth**: Frontend uses `@clerk/react@6.x`; backend uses `@clerk/express` middleware. JWT verified server-side on every protected route.
- **Path-based routing**: Shared reverse proxy routes `/api` to api-server (port 8080) and `/` to digital-workplace. No Vite proxy config needed.
- **`@clerk/react` must be v6.x** (not 5.x — only one stable 5.x release exists: `5.54.0`, which had a broken `@clerk/shared@3.x` peer). Both `@clerk/react` and `@clerk/shared` are in `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.
- **Demo users have `clerk_id` like `demo_user_N`** and won't match real Clerk auth. Seed data is for display only; real users are created on first Clerk login via `/api/users/me` upsert.

## Product

- **Dashboard** — announcements, recent activity, project/task summaries, quick stats
- **Projects** — kanban-style project cards with status/priority, detail view with tasks
- **Tasks** — cross-project task board filterable by status and assignee
- **Documents** — file library with type/tag filtering, starring, upload support
- **HR Management** — attendance clock-in/out, leave requests (submit + approve/reject)
- **Analytics** — department/project metrics, activity trends
- **Admin** — user management, department management
- **Settings** — profile, preferences, notifications

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Seed script uses returned IDs**: departments use auto-increment; seed reads returned `id`s and passes them to subsequent inserts — never hardcode department IDs.
- **`clockIn.mutate()` / `clockOut.mutate()`** take no arguments (void mutation) — call with `undefined`, not `{ data: {} }`.
- **`pnpm run dev` at root doesn't exist** — use `restart_workflow` or individual `--filter` commands.
- **`@types/pg` is not in the pnpm catalog** — add it as an explicit `"^8.11.0"` devDependency if needed.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `clerk-auth` skill for Clerk configuration and customization
