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
- [x] School / vacation points modes (2026-09-28): parent toggle in Settings > Family. School mode awards
      ⅓ of a chore's points (rounded up) on school days; weekends, holidays, and vacation mode earn full
      points. The points day rolls over at 8pm local (Friday night = weekend, Sunday night = school day).
      Kiosk shows a day badge and a PIN-gated Holiday checkbox. Chores can optionally set a custom
      `school_points` value instead of the automatic ⅓. Migrations 0019-0022.

## Backlog

- [x] Real-world test of school mode over the week of 2026-09-28: check the ⅓ split feels right, the
      8pm Friday/Sunday rollover flips the badge and card values, and Holiday switches itself off after
      8pm on the holiday. Adjust per-chore school-day values or the divisor based on how it goes.
      Confirmed working as intended (2026-11-02), no adjustments needed.
- [x] Decide whether "weekends"-frequency chores should also follow the 8pm rollover. Decided
      (2026-11-02) to leave chore visibility on the calendar day for now. Instead, the rollover time
      itself is now a parent setting (Settings > Family, School mode only: 5pm–11pm or midnight;
      `families.rollover_hour`, migrations 0023-0024). Choosing midnight removes the mismatch entirely.

- [x] User account settings (update email and password). Settings > Account (2026-11-02): email change
      via Supabase confirmation links (secure email change is on, so both addresses must confirm; the UI
      says so), password change re-verifies the current password first. Error paths tested; the
      successful password change and the email-confirmation round trip are still untested.
- [x] Create a real favicon/app icon (currently the placeholder Vite logo — also used as the PWA
      manifest home-screen icon, see `public/manifest.webmanifest`). Done 2026-11-03: indigo checkmark
      + gold star from Claude Design (`favicon.svg`, `icon-maskable.svg`), plus PNG exports (32, 180
      apple-touch, 192, 512, 512 maskable) wired into the manifest and `index.html`. Kiosk tablet
      needs its home-screen shortcut re-added after deploy to pick up the new icon.
- [x] Change "Chores" kiosk title (e.g. to the family name). Done 2026-11-02: the kiosk header shows
      `families.name`, which parents can now rename in Settings > Family (shared `useFamily` hook).
- [x] Login page polish: icon/branding + forgot-password flow. Done 2026-11-03: shared `AuthShell`
      (icon + name) on login/signup, `/forgot-password` and `/reset-password` pages (reset form only
      shows when opened from a real recovery link, so the kiosk tablet can't bypass Settings > Account's
      current-password check). Sign-up link removed from login; new-user signup is also disabled in
      Supabase. Needs `/reset-password` in Supabase's redirect URL allowlist; reset email flow
      confirmed working end-to-end (2026-11-03).
- [ ] Let parents track their own chores, not just kids' — bigger than it looks: schema currently has
      `chores.assigned_member_id` reference only kids ("every chore assigned to exactly one kid" was a
      confirmed v1 decision), and kiosk/points/redemption flows all assume the assignee is a kid.
- [x] Lock down the Settings link so only parents can get in — require a parent PIN to enter Settings.
      Implemented as a UI-level gate (not new RLS — the tablet's session already legitimately belongs
      to a parent): `families.settings_pin`, never client-readable (column-level SELECT revoke), only
      exposed via `has_settings_pin()`/`verify_settings_pin()` boolean RPCs. Settings stays open until a
      PIN is set; once set, re-entered via a 4-digit keypad on every visit (no persistence).
- [ ] Parent notifications + redemption approval (planned 2026-11-03). Web Push from the PWA, no APK.
      Android only for now (any push-capable browser: Chrome/Edge/Samsung Internet/Firefox; not in-app
      browsers). Kids don't get accounts: notifications go to **devices a parent opts in**, never to the
      kiosk tablet (which is logged in as a parent but never registers).
  - [x] Phase 1 — Push infrastructure (shipped 2026-11-03; migrations 0025-0026 applied, VAPID secrets
        set, `send-push` deployed; test push confirmed on desktop Chrome and Android Chrome): hand-written `public/sw.js` (push + notificationclick);
        `push_subscriptions` table (device -> parent, endpoint/keys, device+browser label, RLS parents
        only); Settings > Account "Notifications on this device" toggle (detects unsupported browsers),
        "Send test notification", registered-device list with Remove; VAPID keys (public as `VITE_`
        build arg via `.env.production` + `compose.yml`, private in Supabase secrets); `send-push` Edge
        Function (deployed by the user via dashboard/CLI) that prunes dead subscriptions.
  - [x] Phase 2 — Per-chore notification (2026-11-03; migrations 0027-0028 applied, Vault secrets
        `project_url`/`push_webhook_secret` + `PUSH_WEBHOOK_SECRET` set, `send-push` redeployed with
        Verify JWT off; completion push confirmed on desktop): `chores.notify_on_complete` (default off) checkbox in
        ChoreForm; trigger on completion -> `send-push` via `pg_net` ("Lucas finished Make bed (+5)").
        No notification on un-complete.
  - [ ] Phase 3 — Daily report: one family-wide time (`families` column, default 8pm, set in
        Settings > Family); each parent opts in/out in Settings > Account. Hourly `pg_cron` job sends
        each opted-in parent a per-kid summary (chores done/missed, points earned, redemptions).
  - [ ] Phase 4 — Redemption approval: `redemption_requests` (pending -> approved/denied); kiosk
        redeem creates a request, points deducted only on approval, pending points held so they can't
        be double-requested. Push to all registered parent devices; tap opens Approve/Deny. Approve
        server-side requires either the Settings PIN (tablet) or the registered device's secret key
        stored on that phone at registration (one-tap approve on parent phones).
- [ ] Mandatory chores that must be completed before a child can redeem points

## Optional future ideas (not scheduled)

- [ ] Safe testing environment: there's no staging backend, so local dev hits production Supabase. Quick
      option: a separate test family signed up with an email alias (RLS isolates it). Fuller option: a
      local Supabase stack (`supabase start` in Docker) with `supabase/migrations/` applied, to test
      migrations before they go live.

- [ ] Reusable "reset a kid's chores/points" tool (parent-facing settings action or admin script), instead of hand-writing
      one-off SQL each time. Prompted by manually resetting Lucas's test data via SQL Editor on 2026-07-03.
