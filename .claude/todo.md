# chores-chart build plan

Full design plan: see conversation history / `C:\Users\nival\.claude\plans\this-is-an-initial-partitioned-minsky.md` (may not persist across machines — treat this file as the source of truth going forward).

- [x] Phase 1: Supabase project + schema + RLS + auth RPCs (`create_family`/`join_family`) + login/signup pages
- [x] Phase 2: Chores CRUD (settings page + conditional-frequency form) — also added Members and Family (invite code) settings pages, needed as prerequisites for chore assignment and real 2-parent onboarding
- [x] Phase 3: Kiosk board + `complete_chore` + gray-out + confetti
- [x] Phase 4: Points balance display + redemption modal + `redeem_points`
- [x] Phase 5: Nightly `expire_unused_points` job (pg_cron) — also fixed a real security gap where every RPC was callable by the unauthenticated `anon` role (Postgres/Supabase auto-grants EXECUTE to `anon` directly, not via PUBLIC)
- [x] Phase 6: Parent dashboard (earned-vs-redeemed chart + ignored/under-completed highlights)
- [x] Phase 7: Polish (kid-friendly visuals, touch targets, loading/empty/error states) — cross-device emoji
      centering fixed (bundled Twemoji SVGs replacing native OS emoji fonts), kid-color-tinted kiosk cards,
      destructive-action confirmations, fragile error-message matching fixed, loading/empty/error states
      audited across every route. Remaining nice-to-haves split out to Backlog below (favicon, login polish, etc).
- [x] Phase 8: Deploy — containerized (Dockerfile + compose.yml, multi-stage node build -> nginx,
      SPA fallback) and self-hosted on the Raspberry Pi via Docker + Cloudflare Tunnel, live at
      chores.8bitcode.net (port 8001). GitHub Actions CI (lint + typecheck on push/PR) and CD
      (self-hosted runner on the Pi auto-deploys `git pull && docker compose up --build -d` on push
      to main) both wired up and confirmed working end-to-end. Plan changed from the original
      Vercel target since the Pi already runs the rest of the household's self-hosted apps.
- [x] Chore categories: family-scoped, table-backed `categories` (name-only, no icon), nullable
      `chores.category_id`. Chores grouped by category (with an Uncategorized bucket) on both the kiosk
      board and Settings > Chores. Archiving a category reassigns its chores to Uncategorized rather than
      letting them vanish. Not a pre-existing backlog item — added and shipped in the same session.

## Backlog

- [ ] User account settings (update email and password)
- [ ] Create a real favicon/app icon (currently the placeholder Vite logo — also used as the PWA
      manifest home-screen icon, see `public/manifest.webmanifest`)
- [ ] Change "Chores" kiosk title (e.g. to the family name)
- [ ] Login page polish: icon/branding + forgot-password flow
- [ ] Let parents track their own chores, not just kids' — bigger than it looks: schema currently has
      `chores.assigned_member_id` reference only kids ("every chore assigned to exactly one kid" was a
      confirmed v1 decision), and kiosk/points/redemption flows all assume the assignee is a kid.
- [x] Lock down the Settings link so only parents can get in — require a parent PIN to enter Settings.
      Implemented as a UI-level gate (not new RLS — the tablet's session already legitimately belongs
      to a parent): `families.settings_pin`, never client-readable (column-level SELECT revoke), only
      exposed via `has_settings_pin()`/`verify_settings_pin()` boolean RPCs. Settings stays open until a
      PIN is set; once set, re-entered via a 4-digit keypad on every visit (no persistence).

## Optional future ideas (not scheduled)

- [ ] Reusable "reset a kid's chores/points" tool (parent-facing settings action or admin script), instead of hand-writing
      one-off SQL each time. Prompted by manually resetting Lucas's test data via SQL Editor on 2026-07-03.
