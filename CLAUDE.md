# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Feature-complete and in production use: auth (family create/join via RPCs), chores CRUD, kiosk board with
chore completion, points balance + redemption, a nightly points-expiry job, and a parent dashboard. See
`.claude/todo.md` for the phase-by-phase history and the remaining backlog.

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
  `.env` and fill in the project's real values to run against the live Supabase backend.
- Linting via `oxlint` (`.oxlintrc.json`), not ESLint. It's fast but only single-file aware by default; if
  type-aware rules are needed later, see the `oxlint-tsgolint` note left in `README.md`.

## Environment

`.env` (gitignored) must define `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the app to run against
a real Supabase backend. Vite only exposes env vars prefixed `VITE_` to client code.

## Deployment

Self-hosted on the owner's Raspberry Pi, live at `chores.8bitcode.net`. Docker (`Dockerfile` + `compose.yml`,
multi-stage node build -> nginx, SPA fallback for `react-router-dom`) behind Cloudflare Tunnel on port 8001;
the tunnel terminates HTTPS, so nothing in this app forces HTTPS redirects. `VITE_*` vars are baked into the
JS bundle at Docker *build* time (not read at container runtime), so they're passed as `compose.yml` build
args sourced from `.env.production` — a Pi-only file, gitignored (`.env*` / `!.env.example`), never committed.

GitHub Actions handles CI/CD (`.github/workflows/`):
- `ci.yml`: lint + typecheck on every push/PR, GitHub-hosted runner.
- `deploy.yml`: on push to `main`, a self-hosted runner installed on the Pi itself (outbound-only
  registration, no inbound ports opened) runs `git pull && docker compose --env-file .env.production up
  --build -d` directly against the persistent clone at `/home/pi/chores-chart` — deliberately no
  `actions/checkout` step, since `.env.production` never needs to leave the Pi or touch GitHub secrets.
