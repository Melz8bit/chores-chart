// send-push: delivers Web Push notifications to registered parent devices
// (public.push_subscriptions, 0025).
//
// Phase 1 only exposes the "Send test notification" path: a signed-in parent
// asks for a test push to their *own current device*, identified by its
// subscription endpoint. Later phases add server-triggered sends (chore
// completed, daily report, redemption requests) on top of sendToSubscriptions.
//
// Secrets (Supabase dashboard > Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com)
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Identify the caller from their own JWT (the platform has already checked
  // it's valid, since verify_jwt is on by default).
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
