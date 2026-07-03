# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This is a freshly scaffolded project with no features implemented yet — just the Vite/React/Tailwind/Supabase
skeleton. There is no domain code (chores, users, assignments, etc.) to reference yet. When implementing
features, establish the architecture as you go rather than looking for existing patterns to follow.

## Commands

```
npm run dev        # start Vite dev server with HMR
npm run build      # tsc -b (typecheck, no emit) + vite build
npm run lint        # oxlint
npm run preview    # preview the production build locally
```

There is no test runner configured yet.

## Tech stack

- React 19 + Vite 8 + TypeScript
- Tailwind CSS v4, wired in via the `@tailwindcss/vite` plugin (`vite.config.ts`) — no `tailwind.config.js`
  or PostCSS config needed; `src/index.css` just does `@import "tailwindcss";`
- Supabase (`@supabase/supabase-js`) for backend/persistence. Client is created in `src/lib/supabase.ts`,
  reading `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the environment. Copy `.env.example` to
  `.env` and fill in real values — a Supabase project has not been provisioned yet.
- Linting via `oxlint` (`.oxlintrc.json`), not ESLint. It's fast but only single-file aware by default; if
  type-aware rules are needed later, see the `oxlint-tsgolint` note left in `README.md`.

## Environment

`.env` (gitignored) must define `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the app to run against
a real Supabase backend. Vite only exposes env vars prefixed `VITE_` to client code.
