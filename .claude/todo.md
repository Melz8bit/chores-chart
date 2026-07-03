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
- [ ] Phase 8: Deploy to Vercel

## Backlog

- [ ] User account settings (update email and password)
- [ ] Create a real favicon/app icon (currently the placeholder Vite logo — also used as the PWA
      manifest home-screen icon, see `public/manifest.webmanifest`)
- [ ] Change "Chores" kiosk title (e.g. to the family name)
- [ ] Login page polish: icon/branding + forgot-password flow
- [ ] Let parents track their own chores, not just kids' — bigger than it looks: schema currently has
      `chores.assigned_member_id` reference only kids ("every chore assigned to exactly one kid" was a
      confirmed v1 decision), and kiosk/points/redemption flows all assume the assignee is a kid.

## Optional future ideas (not scheduled)

- [ ] Reusable "reset a kid's chores/points" tool (parent-facing settings action or admin script), instead of hand-writing
      one-off SQL each time. Prompted by manually resetting Lucas's test data via SQL Editor on 2026-07-03.
