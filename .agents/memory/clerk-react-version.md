---
name: Clerk React version
description: Which @clerk/react version to use and why v5 is broken
---

**Rule:** Always install `@clerk/react@latest` (currently `6.7.1`). Do NOT pin to `5.x`.

**Why:** As of May 2026, `5.54.0` is the only stable `5.x` release ever published. It declares `@clerk/shared@^3.33.0`, but the `3.x` series (`3.47.6`) is missing `loadClerkUiScript` which `5.54.0` imports. There is no working `@clerk/react@5.x` combination.

**How to apply:**
- Use `@clerk/react@6.7.1` (or `@clerk/react@latest`) in `artifacts/digital-workplace/package.json`.
- Both `@clerk/react` and `@clerk/shared` are listed in `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` to allow same-day releases to install.
- The `@clerk/express` backend package (v2.x) uses `@clerk/shared@^4.x` — compatible with frontend v6 peer requirements.
- All v6 APIs used here (`ClerkProvider`, `SignIn`, `SignUp`, `Show`, `useClerk`, `publishableKeyFromHost` from `@clerk/react/internal`) are present in `6.7.1`.
