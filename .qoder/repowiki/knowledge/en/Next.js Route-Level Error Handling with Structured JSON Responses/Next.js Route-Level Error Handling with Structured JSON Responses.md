---
kind: error_handling
name: Next.js Route-Level Error Handling with Structured JSON Responses
category: error_handling
scope:
    - '**'
source_files:
    - app/api/create-demo-account/route.ts
    - app/api/dashboard/route.ts
    - app/api/run-matching/route.ts
    - app/api/run-matching-for-case/route.ts
    - lib/db/supabase-admin.ts
    - lib/auth/index.ts
    - lib/auth/session.ts
---

## What system/approach is used

The repository uses a **per-route try/catch pattern** in Next.js App Router API handlers (`app/api/*/*.ts`). Each route wraps its logic in a `try { ... } catch (err: any) { ... }` block and returns errors as structured JSON via `NextResponse.json({ error: ... }, { status })`. There is no centralized error middleware, no custom error class hierarchy, and no global error boundary for API routes. Errors are surfaced to clients as plain `{ error: string }` payloads with HTTP status codes.

Supabase client calls return `{ data, error }` tuples; the code treats `error !== null` as an error condition and maps it to a `NextResponse.json` response rather than throwing. The server-side Supabase admin client (`lib/db/supabase-admin.ts`) throws a synchronous `Error` when required environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are missing — this is the only place where `throw new Error(...)` is used outside of a route's catch block.

## Key files and packages

- `app/api/create-demo-account/route.ts` — demo account creation; validates input, handles Supabase auth/admin errors, catches unexpected exceptions.
- `app/api/dashboard/route.ts` — GET/POST handler for reporter/finder dashboards; performs authorization header checks, Supabase queries, and action dispatching; centralizes 401/403/404/500 responses.
- `app/api/run-matching/route.ts` — forward matching (sighting → cases); parses embeddings, compares scores against thresholds, inserts match records, updates sighting status.
- `app/api/run-matching-for-case/route.ts` — reverse matching (case → sightings); batch-inserts matches, updates sighting statuses.
- `lib/db/supabase-admin.ts` — creates a Supabase Admin client using the service role key; throws if env vars are missing.
- `lib/auth/index.ts` and `lib/auth/session.ts` — client-side session helpers that swallow errors by returning `null` / `{ isLoggedIn: false }` instead of propagating them.
- `lib/ai-matching/compare.ts` and `lib/ai-matching/embeddings.ts` — AI matching utilities that catch parsing/network errors locally and log them.

## Architecture and conventions

1. **Input validation returns 400 immediately.** Routes check required fields and types before touching the database:
   - `create-demo-account`: requires `email` and `password`.
   - `run-matching`: requires `sightingId` as a string.
   - `run-matching-for-case`: requires `caseId` as a string.
   - `dashboard` POST: requires `matchId` or `caseId` depending on action.

2. **Authorization is checked at the top of protected routes.** Both `dashboard` GET and POST read the `Authorization` header, strip the `Bearer ` prefix, call `supabaseAdmin.auth.getUser(token)`, and return 401 with `{ error: 'Missing authorization header' }` or `{ error: 'Unauthorized session' }`.

3. **Supabase RLS bypass via Admin client.** All write/read operations in API routes use `getSupabaseAdmin()` (service role), so business logic enforces ownership checks manually (e.g., verifying `reporter_id === user.id` before allowing `update_match` or `resolve_case` actions). Ownership failures return 403 with `{ error: 'Forbidden: You do not own this case.' }`.

4. **Structured error shape.** Every error response follows `{ error: string }` plus an HTTP status. Success responses include a `success: true` field and domain-specific payload (`userId`, `match`, `matches`, `myCases`, `mySightings`).

5. **Status code conventions observed:**
   - `400` — bad request / missing input / parse failure (e.g., invalid embedding JSON).
   - `401` — missing or invalid Authorization header.
   - `403` — authenticated but not authorized (ownership check failed).
   - `404` — resource not found (sighting or case missing).
   - `500` — database query error, insert failure, or unhandled exception.

6. **Logging vs. error propagation.** Database-level errors are logged via `console.error('[Dashboard API] ...', err)` before returning a 500. Non-fatal issues (e.g., profile upsert failing during demo account creation) are logged with `console.warn` and allowed to proceed. Missing embeddings are treated as a successful no-op path returning `{ success: true, message: '...' }` rather than an error.

7. **AI matching error handling.** Embedding parsing (`JSON.parse`) is wrapped in per-iteration try/catch blocks that `continue` to the next item, so one malformed embedding does not abort the whole batch. Network errors from face-api calls are caught and logged, then converted into a 400 response.

8. **Client-side session helpers swallow errors.** `getCurrentSession` and `getCurrentUser` return `null` / `{ isLoggedIn: false }` on any error, never surfacing errors to callers.

## Conventions and constraints

- **Every API route must be wrapped in try/catch** and return `NextResponse.json({ error: ... }, { status })` for both expected and unexpected failures. This is consistently enforced across all four route files.
- **Protected routes must validate the Authorization header** before performing any privileged operation; absence yields 401, invalid token yields 401.
- **Ownership checks are explicit per action.** After fetching a related record, routes compare `reporter_id` against `user.id` and return 403 if they differ — there is no shared authorization helper.
- **Supabase Admin client must have both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set**; `getSupabaseAdmin()` throws synchronously otherwise, which will bubble up to the route's catch block and produce a 500.
- **No custom error classes or error codes exist.** Errors are represented as plain strings inside `{ error }` objects; there is no enum of error codes or typed error union.
- **Non-fatal failures are tolerated, not fatal.** Examples: profile upsert warning during demo account creation, malformed embedding rows skipped in matching loops, missing embeddings returning a success/no-match response.
- **There is no global error middleware or `error.ts` boundary** for API routes; each route handles its own errors independently.