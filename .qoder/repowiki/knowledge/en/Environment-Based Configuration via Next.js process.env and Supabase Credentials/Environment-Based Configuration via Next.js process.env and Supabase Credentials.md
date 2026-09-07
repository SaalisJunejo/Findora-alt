---
kind: configuration_system
name: Environment-Based Configuration via Next.js process.env and Supabase Credentials
category: configuration_system
scope:
    - '**'
source_files:
    - .env.example
    - .env.local
    - lib/db/supabase.ts
    - lib/db/supabase-admin.ts
    - next.config.ts
---

## What system/approach is used

The application uses a flat, environment-variable-driven configuration approach built on Next.js's native `process.env` loading. There is no dedicated configuration library (e.g., dotenv, config, convict) — all runtime settings are consumed directly from Node/Next.js environment variables. The project follows the standard Next.js convention of using `.env.local` for local overrides and `.env.example` as a template for required variables.

## Key files and packages

- `.env.example` — documents every required environment variable with placeholder values; serves as the single source of truth for what must be configured.
- `.env.local` — contains actual credentials for local development (Supabase URL, anon key, service role key).
- `lib/db/supabase.ts` — client-side Supabase client initialized from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; emits a console warning if either is missing.
- `lib/db/supabase-admin.ts` — server-side admin client factory (`getSupabaseAdmin()`) that reads `SUPABASE_SERVICE_ROLE_KEY` plus the shared URL; throws a hard error at call time if either is missing, and disables token refresh/persistence for admin usage.
- `next.config.ts` — Next.js configuration file (currently empty default export); no build-time or runtime config flags are set here.
- `package.json` — defines scripts (`dev`, `build`, `start`, `lint`) but no configuration-related dependencies beyond the framework itself.

## Architecture and conventions

1. **Variable scoping by prefix**: Variables intended for the browser are prefixed with `NEXT_PUBLIC_` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Server-only secrets use an unprefixed name (`SUPABASE_SERVICE_ROLE_KEY`) and are never imported into client components. This separation is enforced by how the two Supabase clients are constructed: the anonymous client in `supabase.ts` only reads `NEXT_PUBLIC_*` vars, while the admin client in `supabase-admin.ts` reads the service role key exclusively.

2. **Fail-fast vs fail-warn**: Client-side DB access warns on missing variables (`console.warn`), allowing the app to render without crashing. Server-side admin access throws an explicit `Error` when called, ensuring misconfiguration is caught early during API route execution.

3. **Single external dependency for config**: The only runtime configuration concern is Supabase connection parameters. No feature flags, per-environment YAML/TOML files, or centralized config objects exist.

4. **No build-time configuration**: `next.config.ts` exports an empty `NextConfig` object; there are no `publicRuntimeConfig` / `serverRuntimeConfig` patterns, no `withXxx` wrappers, and no injected constants at build time.

5. **Secrets management pattern**: Secrets live in `.env.local` (which is gitignored via `.gitignore`) and are documented in `.env.example`. There is no secret rotation, vault integration, or CI-specific env injection visible in this repo.

## Conventions and constraints

- All Supabase credentials must be present as environment variables before running the app; missing client-side variables produce a console warning, while missing admin variables throw at runtime.
- The service role key must never be imported or used in any client component — this is documented inline in `lib/db/supabase-admin.ts` with an `IMPORTANT` comment.
- New configuration keys should follow the `NEXT_PUBLIC_` prefix convention for anything exposed to the browser and remain unprefixed for server-only secrets.
- There is no schema validation, type checking, or default-value resolution layer over `process.env`; consumers read raw strings and handle emptiness themselves.