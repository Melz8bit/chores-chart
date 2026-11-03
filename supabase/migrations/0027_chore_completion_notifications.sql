-- Phase 2 of parent notifications: a chore can be flagged so that every
-- completion of it pushes a notification to the family's registered parent
-- devices (push_subscriptions, 0025) via the send-push Edge Function.
alter table public.chores
  add column notify_on_complete boolean not null default false;

-- pg_net lets the database make async HTTP calls; requests are queued and
-- sent after the transaction commits, so they never slow down or roll back
-- complete_chore.
create extension if not exists pg_net;

-- Prerequisite (run once by hand in the SQL Editor, NOT in a migration, so
-- the values never land in git):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random secret>', 'push_webhook_secret');
-- push_webhook_secret must match the PUSH_WEBHOOK_SECRET Edge Function secret.
--
-- Only the completion id is sent; send-push looks up the kid, chore and
-- points itself, so even a request with a leaked secret can't push arbitrary
-- text, only re-announce a real completion to that completion's own family.
create function public.notify_chore_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notify boolean;
  v_url text;
  v_secret text;
begin
  select notify_on_complete into v_notify from public.chores where id = new.chore_id;
  if not coalesce(v_notify, false) then
    return new;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return new; -- notifications not configured; never block the completion
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object('type', 'chore_completed', 'completion_id', new.id)
  );
  return new;
exception when others then
  -- A notification problem must never stop a kid from completing a chore.
  raise warning 'notify_chore_completed failed: %', sqlerrm;
  return new;
end;
$$;

create trigger chore_completions_notify
  after insert on public.chore_completions
  for each row execute function public.notify_chore_completed();
