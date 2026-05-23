---
name: Seed script pattern
description: How to write seed scripts that work with auto-increment PKs and FK constraints
---

**Rule:** Never hardcode serial/auto-increment primary key values across related inserts. Always capture returned `id`s and pass them to subsequent queries.

**Why:** PostgreSQL sequences are not reset on rollback — IDs from failed transactions are consumed. If the first run fails and rolls back, the next run's auto-increment IDs will be higher than expected, breaking any hardcoded FK references.

**How to apply:**
- Use `INSERT ... RETURNING id, name` and store the result.
- Write a helper like `rowId(rows, idx): number | null` that returns `rows[idx]?.id ?? null` to safely handle missing rows.
- Pass `null` (not `undefined`) for optional FK columns — pg can't serialize `undefined`.
- Insert one row at a time (or small batches) when row count varies, to avoid parameter placeholder mismatches.
- For idempotent re-runs on tables with unique constraints (e.g. `clerk_id`), use `ON CONFLICT (column) DO NOTHING`. For tables without a unique constraint, check existence first or clear the table.
- Location: `scripts/src/seed.ts`, run via `pnpm --filter @workspace/scripts run seed`.
