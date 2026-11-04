// send-push: delivers Web Push notifications to registered parent devices
// (public.push_subscriptions, 0025).
//
// Two ways in:
// - Server-triggered (x-push-secret header): database triggers call this via
//   pg_net with just an event type and a row id; the details are looked up
//   here. Currently: { type: 'chore_completed', completion_id } (0027) and
//   { type: 'daily_report', family_id } (0029) and
//   { type: 'redemption_requested', request_id } (0033).
// - "Send test notification" (user JWT): a signed-in parent asks for a test
//   push to their *own current device*, identified by its endpoint.
//
// Deploy with **Verify JWT turned OFF**: pg_net requests carry no user JWT.
// Each path authenticates itself instead (shared secret / auth.getUser()).
//
// Secrets (Supabase dashboard > Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com)
//   PUSH_WEBHOOK_SECRET (must match the push_webhook_secret Vault secret)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided
// automatically by the Edge Functions runtime.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PushPayload {
  title: string
  body: string
  // Path in the app to open when the notification is tapped.
  url?: string
  // Notifications with the same tag replace each other instead of stacking.
  tag?: string
}

interface SubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? '',
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
)

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// Sends to each subscription; returns how many were delivered. Subscriptions
// the push service reports as gone (404/410: permission revoked, site data
// cleared, browser uninstalled) are deleted so they stop being tried.
async function sendToSubscriptions(rows: SubscriptionRow[], payload: PushPayload): Promise<number> {
  let delivered = 0
  const gone: string[] = []
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        )
        delivered++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          gone.push(row.id)
        } else {
          console.error('push failed', row.id, status, err)
        }
      }
    }),
  )
  if (gone.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', gone)
  }
  return delivered
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function familySubscriptions(familyId: string) {
  return admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('family_id', familyId)
}

async function handleChoreCompleted(completionId: string) {
  const { data: completion } = await admin
    .from('chore_completions')
    .select('id, family_id, chore_id, family_member_id, points_awarded')
    .eq('id', completionId)
    .maybeSingle()
  if (!completion) return json({ error: 'Completion not found' }, 404)

  const [{ data: chore }, { data: kid }, { data: rows }] = await Promise.all([
    admin.from('chores').select('name, emoji').eq('id', completion.chore_id).single(),
    admin.from('family_members').select('display_name').eq('id', completion.family_member_id).single(),
    familySubscriptions(completion.family_id),
  ])
  if (!rows || rows.length === 0) return json({ delivered: 0 })

  const choreName = [chore?.emoji, chore?.name].filter(Boolean).join(' ')
  const points = completion.points_awarded
  const delivered = await sendToSubscriptions(rows, {
    title: `✅ ${kid?.display_name ?? 'A kid'} finished a chore`,
    body: `${choreName} (+${points} ${points === 1 ? 'point' : 'points'})`,
    url: '/',
    tag: `completion-${completion.id}`,
  })
  return json({ delivered })
}

interface DailyReportRow {
  kid_name: string
  chores_due: number
  chores_done: number
  still_to_do: string[]
  points_earned: number
  points_redeemed: number
}

// One block per kid, e.g.
//   Lucas: 4/5 chores · +18 pts · spent 10
//   Still to do: 🛏️ Make bed
function describeKidDay(row: DailyReportRow): string {
  const parts: string[] = []
  if (row.chores_due > 0) parts.push(`${row.chores_done}/${row.chores_due} chores`)
  parts.push(`+${row.points_earned} pts`)
  if (row.points_redeemed > 0) parts.push(`spent ${row.points_redeemed}`)
  const lines = [`${row.kid_name}: ${parts.join(' · ')}`]
  if (row.still_to_do.length > 0) lines.push(`Still to do: ${row.still_to_do.join(', ')}`)
  return lines.join('\n')
}

// Sent by the send_daily_reports cron sweep (0029). Goes only to devices of
// parents who opted in (family_members.daily_report).
async function handleDailyReport(familyId: string) {
  const [{ data: report, error }, { data: rows }] = await Promise.all([
    admin.rpc('get_daily_report', { p_family_id: familyId }),
    admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, family_members!inner(daily_report)')
      .eq('family_id', familyId)
      .eq('family_members.daily_report', true),
  ])
  if (error) return json({ error: error.message }, 500)
  const kids = (report ?? []) as DailyReportRow[]
  if (!rows || rows.length === 0 || kids.length === 0) return json({ delivered: 0 })

  const delivered = await sendToSubscriptions(rows, {
    title: "📋 Today's chores",
    body: kids.map(describeKidDay).join('\n'),
    url: '/dashboard',
    tag: 'daily-report',
  })
  return json({ delivered })
}

// A kid asked to redeem points on the kiosk (0033). Goes to every registered
// parent device; tapping opens the approve/deny page.
async function handleRedemptionRequested(requestId: string) {
  const { data: request } = await admin
    .from('redemption_requests')
    .select('id, family_id, amount, status, family_members!redemption_requests_family_member_id_fkey(display_name, points_balance)')
    .eq('id', requestId)
    .maybeSingle()
  if (!request) return json({ error: 'Request not found' }, 404)
  if (request.status !== 'pending') return json({ delivered: 0 })

  const { data: rows } = await familySubscriptions(request.family_id)
  if (!rows || rows.length === 0) return json({ delivered: 0 })

  const kid = request.family_members as unknown as { display_name: string; points_balance: number } | null
  const delivered = await sendToSubscriptions(rows, {
    title: `🎁 ${kid?.display_name ?? 'A kid'} wants to redeem ${request.amount} points`,
    body: `Balance: ${kid?.points_balance ?? '?'} points. Tap to approve or deny.`,
    url: `/approve/${request.id}`,
    tag: `redemption-${request.id}`,
  })
  return json({ delivered })
}

// Server-triggered requests. The secret only proves the caller is our own
// database; the payload is just an id, and everything shown is looked up.
async function handleServerEvent(req: Request) {
  const expected = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (!expected || req.headers.get('x-push-secret') !== expected) {
    return json({ error: 'Forbidden' }, 403)
  }
  const body = (await req.json().catch(() => ({}))) as {
    type?: string
    completion_id?: string
    family_id?: string
    request_id?: string
  }
  if (body.type === 'chore_completed' && body.completion_id) {
    return handleChoreCompleted(body.completion_id)
  }
  if (body.type === 'daily_report' && body.family_id) {
    return handleDailyReport(body.family_id)
  }
  if (body.type === 'redemption_requested' && body.request_id) {
    return handleRedemptionRequested(body.request_id)
  }
  return json({ error: 'Unknown event' }, 400)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.headers.has('x-push-secret')) {
    return handleServerEvent(req)
  }

  // Test path: identify the caller from their own JWT. Verify JWT is off for
  // this function (see top), so getUser() is what rejects bad/missing tokens.
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) {
    return json({ error: 'Not signed in' }, 401)
  }

  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string }
  if (!endpoint) {
    return json({ error: 'Missing endpoint' }, 400)
  }

  // Only the caller's own registered device: the row's parent must be them.
  const { data: rows, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, family_members!inner(auth_user_id)')
    .eq('endpoint', endpoint)
    .eq('family_members.auth_user_id', user.id)
  if (error) {
    return json({ error: error.message }, 500)
  }
  if (!rows || rows.length === 0) {
    return json({ error: 'This device is not registered for notifications' }, 404)
  }

  const delivered = await sendToSubscriptions(rows, {
    title: 'Chores Chart',
    body: 'Notifications are working on this device. 🎉',
    url: '/settings/account',
    tag: 'test',
  })
  return json({ delivered })
})
