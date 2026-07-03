# Database migrations

No Supabase CLI/MCP link to this project — apply these manually in the Supabase dashboard's
**SQL Editor**, in filename order (`0001_...`, `0002_...`, etc). Each file is idempotent-ish but
not re-runnable as-is (uses `create table`/`create policy`, not `if not exists` everywhere) — if
you need to re-apply one, drop the affected objects first or ask for a corrected version.

Current migrations:
- `0001_schema.sql` — the five core tables (families, family_members, chores, chore_completions, point_transactions)
- `0002_rls_and_auth.sql` — RLS policies, `current_family_id()`, `create_family()`, `join_family()`
- `0003_fix_points_balance_grant.sql` — closes a gap found during manual testing where a column-level
  `REVOKE UPDATE (points_balance) ...` had no effect because Supabase's default table-wide grant still
  covered it (Postgres keeps table- and column-level grants as separate layers — see comments in the file)

More will be added as later phases (chore completion, redemption, points expiry) are built.
