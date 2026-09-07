---
kind: build_system
name: Next.js App Build & Dev Toolchain
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - next.config.ts
    - tsconfig.json
    - eslint.config.mjs
    - postcss.config.mjs
    - .gitignore
    - README.md
---

## What system/approach is used

This repository is a **Next.js 16** application built entirely through the framework's own tooling. There are no custom Makefiles, Dockerfiles, shell build scripts, or CI/CD pipelines in the repo. The build pipeline is defined by `package.json` scripts that wrap `next build`, `next dev`, and `next start`. Deployment is documented as targeting **Vercel**, the default Next.js hosting platform.

## Key files and packages

- `package.json` — declares the project (`findora`, version `0.1.0`, private), all runtime dependencies (Next.js 16.3.4, React 19.2.8, Supabase client, face-api, Leaflet) and dev dependencies (TypeScript 5, ESLint 9, Tailwind CSS v4 via `@tailwindcss/postcss`). Scripts: `dev`, `build`, `start`, `lint`.
- `next.config.ts` — empty Next.js config object; no custom webpack, output, or asset overrides.
- `tsconfig.json` — TypeScript configured with `target: ES2017`, `strict: true`, `noEmit: true` (Next.js handles emission), `module: esnext`, `moduleResolution: bundler`, JSX `react-jsx`, incremental builds, and an `@/*` path alias mapping to the repo root.
- `eslint.config.mjs` — uses the new flat config format, extending `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`; ignores `.next`, `out`, `build`, and generated `next-env.d.ts`.
- `postcss.config.mjs` — registers `@tailwindcss/postcss` for CSS processing.
- `.gitignore` — excludes `node_modules`, `.env.local`, and other typical artifacts.
- `README.md` — documents Vercel deployment and links to Next.js deployment docs.

## Architecture and conventions

- **Build entry points**: `npm run build` invokes `next build`, which compiles the App Router pages under `app/`, generates static assets into `.next/`, and produces server-side bundles. `npm run dev` starts the development server; `npm run start` runs the production server.
- **TypeScript compilation**: TypeScript is present but set to `noEmit: true`; type-checking is delegated to the Next.js build pipeline via the `next` tsconfig plugin. Path aliases (`@/*`) are resolved at compile time.
- **CSS pipeline**: Tailwind CSS v4 is processed through PostCSS using the `@tailwindcss/postcss` plugin; styles live alongside components/pages and are bundled by Next.js.
- **Linting**: ESLint 9 flat config enforces Next.js + TypeScript rules plus Core Web Vitals metrics; there is no pre-commit hook or CI step enforcing lint in this repo.
- **Environment configuration**: `.env.example` and `.env.local` exist for secrets; `.env.local` is gitignored. No environment variable schema validation is enforced at build time.
- **Asset handling**: Pre-trained face recognition models (`.bin`, `.json`) are shipped under `public/models/` and served statically by Next.js; they are not part of the JS bundle.

## Conventions and constraints

- **No custom build scripts**: All build orchestration goes through `next` CLI commands declared in `package.json` scripts. There are no `Makefile`, `Dockerfile`, `docker-compose.yml`, GitHub Actions workflows, or `vercel.json` in the repository.
- **Strict TypeScript**: `strict: true` and `isolatedModules: true` are enforced in `tsconfig.json`; `skipLibCheck: true` is used to speed up builds against third-party types.
- **Path alias convention**: All imports use the `@/*` alias mapped to the repository root, so modules import each other with absolute paths like `@/lib/db` rather than relative traversals.
- **Deployment target**: The README explicitly recommends deploying to **Vercel**; no alternative deployment targets (Docker, self-hosted servers) are configured or documented in the codebase.
- **Versioning**: The package version is `0.1.0` and marked `private: true`, indicating this is an internal/hackathon project without published npm releases.