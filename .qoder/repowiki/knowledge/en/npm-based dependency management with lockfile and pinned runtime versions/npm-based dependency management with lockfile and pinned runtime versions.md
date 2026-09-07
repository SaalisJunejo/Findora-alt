---
kind: dependency_management
name: npm-based dependency management with lockfile and pinned runtime versions
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
---

## What system/approach is used

The repository uses **npm** as its package manager for a Next.js 16 (React 19) application. Dependencies are declared in `package.json` and resolved/locked via `package-lock.json` (lockfileVersion 3). There is no vendoring of npm packages — all third-party code is fetched from the public npm registry at install time.

## Key files and packages

- `package.json` — single source of truth for declared dependencies and devDependencies, plus build/dev scripts (`dev`, `build`, `start`, `lint`).
- `package-lock.json` — deterministic lockfile pinning every transitive dependency to an exact version and integrity hash, ensuring reproducible installs across environments.
- `.next/` — Next.js build output directory; not a dependency store but evidence that builds run against the locked dependency tree.
- `public/models/` — pre-trained face-api model weights (`.bin`, `.json`) shipped as static assets alongside the app; these are binary artifacts managed separately from npm packages.

Declared runtime dependencies include `next` (16.3.4), `react` / `react-dom` (19.2.8), `@supabase/supabase-js`, `leaflet` + `react-leaflet`, `@vladmandic/face-api`, `@vercel/analytics`, and `@types/leaflet`. Dev dependencies cover TypeScript, ESLint, Tailwind CSS v4, and PostCSS integration.

## Architecture and conventions

- **Single manifest**: All dependencies live in one `package.json`; there are no workspaces or monorepo structures.
- **Versioning style**: Runtime dependencies use caret ranges (e.g. `^2.114.0`, `^1.9.4`, `^5.0.0`) allowing minor/patch updates within the major version, while some core framework packages (`next`, `react`, `react-dom`, `eslint-config-next`) are pinned to exact versions to keep the stack tightly aligned.
- **Deterministic installs**: The presence of `package-lock.json` means `npm ci` can be used in CI to enforce an exact install tree matching the committed lockfile.
- **Build toolchain coupling**: `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, and `tsconfig.json` coordinate with the declared dependencies (Next.js, Tailwind v4 via `@tailwindcss/postcss`, ESLint v9, TypeScript v5).

## Conventions and constraints

- **No private registry or scoped packages beyond npm defaults**: All packages resolve from the public npm registry; no `.npmrc` or custom registry configuration was found.
- **No vendoring of JS dependencies**: No `node_modules` snapshotting or vendored copies exist in the repo; only the lockfile is committed.
- **Binary ML models are treated as static assets**: Face recognition models under `public/models/` are checked into the repo rather than downloaded at runtime, so they must be updated manually alongside any code that consumes them.
- **Scripts encapsulate lifecycle**: Development, building, and linting are exposed through npm scripts in `package.json` rather than ad-hoc shell commands, making dependency usage explicit to contributors.