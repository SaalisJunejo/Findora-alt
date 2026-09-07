---
kind: frontend_style
name: Tailwind CSS v4 with Next.js App Router and Dark-Mode Design Tokens
category: frontend_style
scope:
    - '**'
source_files:
    - app/globals.css
    - postcss.config.mjs
    - app/layout.tsx
    - components/Header.tsx
    - app/dashboard/page.tsx
    - package.json
---

## What system/approach is used

The Findora frontend uses **Tailwind CSS v4** (via `@tailwindcss/postcss` plugin) integrated into a **Next.js 16 App Router** application. Styling is entirely utility-first — there are no custom CSS frameworks, component libraries, or CSS-in-JS solutions. The only global stylesheet is `app/globals.css`, which imports Tailwind via the new `@import "tailwindcss"` directive and defines design tokens using Tailwind's `@theme inline` block.

## Key files and packages

- `postcss.config.mjs` — registers `@tailwindcss/postcss` as the sole PostCSS plugin.
- `package.json` — declares `tailwindcss: ^4` and `@tailwindcss/postcss: ^4` as dev dependencies; no other styling-related packages.
- `app/globals.css` — single source of truth for global styles, theme tokens, and dark-mode overrides.
- `app/layout.tsx` — loads Google Fonts (`Geist`, `Geist_Mono`) via `next/font/google`, exposes them as CSS variables, and applies `antialiased` + full-height layout classes.
- `components/Header.tsx` — shared UI component styled exclusively with Tailwind utility classes.
- `app/dashboard/page.tsx` — representative page showing consistent use of Tailwind utilities across the app.

## Architecture and conventions

### Theme tokens
Global design tokens are declared in `app/globals.css` under `:root` and exposed to Tailwind through the `@theme inline` block:
- `--color-background` / `--color-foreground` map to CSS custom properties that switch values between light and dark modes.
- `--font-sans` / `--font-mono` map to CSS variable names populated by `next/font/google` (`--font-geist-sans`, `--font-geist-mono`).

### Dark mode strategy
Dark mode is implemented via a `prefers-color-scheme: dark` media query that redefines `--background` and `--foreground` on `:root`. Components then consume these tokens directly (e.g., `bg-slate-950`, `text-slate-50`) rather than relying on Tailwind's built-in `dark:` variants, giving the app a consistently dark-themed appearance regardless of system preference.

### Typography
Typography is centralized in `app/layout.tsx` using `next/font/google` to load `Geist` (sans) and `Geist_Mono` (mono). The font variable names are passed to the `<html>` element's `className` so they can be referenced as CSS variables in `globals.css`'s `@theme` block. The `body` rule also falls back to `Arial, Helvetica, sans-serif`.

### Component styling
All React components (`Header.tsx`, `LocationPickerMap.tsx`, and all pages under `app/`) are styled purely with Tailwind utility classes applied via the `className` attribute. There are no CSS modules, styled-components, or class-based BEM patterns. Layouts rely on Flexbox utilities (`flex`, `flex-col`, `items-center`, `justify-between`, `gap-*`) and spacing utilities (`px-*`, `py-*`, `space-y-*`).

### Responsive strategy
Responsive behavior is handled through Tailwind's standard breakpoint prefixes (e.g., `sm:` in `dashboard/page.tsx` and `Header.tsx`), with no custom breakpoints or media queries beyond the dark-mode one in `globals.css`.

### Global base styles
`globals.css` sets minimal base styles: background/foreground colors from CSS variables, body font family fallback, and a full-height flex column layout inherited by `layout.tsx`. No additional reset or base typography rules exist beyond what Tailwind provides.

## Conventions and constraints

- **Utility-only styling**: All visual presentation is expressed through Tailwind utility classes; no custom CSS classes are defined beyond the root token variables.
- **Token-driven colors**: Background and foreground colors are consumed via the `--color-background` / `--color-foreground` theme tokens rather than hardcoded color values at the global level.
- **Font variables via next/font**: Font families are loaded through `next/font/google` and exposed as CSS variables (`--font-geist-sans`, `--font-geist-mono`) referenced in the Tailwind `@theme` block — fonts should not be imported elsewhere.
- **Dark-first palette**: Pages consistently use the slate/indigo/emerald palette against dark backgrounds (`bg-slate-950`, `bg-slate-900/80`, `text-slate-50`, `text-indigo-400`), indicating a dark-first design approach.
- **No custom Tailwind config file**: Customization lives exclusively in `app/globals.css` via `@theme inline`; there is no `tailwind.config.*` file in the repository.