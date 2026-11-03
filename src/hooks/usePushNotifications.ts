import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY: string | undefined = import.meta.env.VITE_VAPID_PUBLIC_KEY

// In-app browsers (a link opened from Gmail, Messages, ...) and some privacy
// browsers lack the Push API entirely; the UI explains that instead of
// offering a toggle that can't work.
export const pushSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export const pushConfigured = !!VAPID_PUBLIC_KEY

export interface RegisteredDevice {
  id: string
  endpoint: string
  device_label: string
  created_at: string
  owner_name: string
}

// The VAPID public key is base64url; PushManager.subscribe wants raw bytes.
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function browserName(ua: string): string {
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet'
  if (/EdgA?\//.test(ua)) return 'Edge'
  if (/OPR\//.test(ua)) return 'Opera'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  return 'Browser'
}

function osName(ua: string): string {
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad/.test(ua)) return 'iOS'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown device'
}

// e.g. "Pixel 8 · Chrome". Chromium browsers expose the phone model through
// User-Agent Client Hints; elsewhere fall back to the OS name.
async function describeThisDevice(): Promise<string> {
  const ua = navigator.userAgent
  let model = ''
  const uaData = (
    navigator as Navigator & {
      userAgentData?: { getHighEntropyValues(hints: string[]): Promise<{ model?: string }> }
    }
  ).userAgentData
  if (uaData) {
    try {
      model = (await uaData.getHighEntropyValues(['model'])).model ?? ''
    } catch {
      // Client hints unavailable; fall back to the OS name.
    }
  }
  return `${model || osName(ua)} · ${browserName(ua)}`
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

// This browser's own push subscription endpoint (null if not subscribed).
export function useThisDeviceEndpoint() {
  return useQuery({
    queryKey: ['pushThisDevice'],
    queryFn: async () => (await currentSubscription())?.endpoint ?? null,
    enabled: pushSupported,
  })
}

export function useRegisteredDevices(familyId: string | undefined) {
  return useQuery({
    queryKey: ['pushDevices', familyId],
    queryFn: async (): Promise<RegisteredDevice[]> => {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, device_label, created_at, family_members(display_name)')
        .order('created_at')
      if (error) throw error
      return data.map((row) => ({
        id: row.id,
        endpoint: row.endpoint,
        device_label: row.device_label,
        created_at: row.created_at,
        owner_name: (row.family_members as unknown as { display_name: string } | null)?.display_name ?? '',
      }))
    },
    enabled: !!familyId,
  })
}

function useInvalidatePush() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['pushThisDevice'] })
    queryClient.invalidateQueries({ queryKey: ['pushDevices'] })
  }
}

export function useEnablePush() {
  const invalidate = useInvalidatePush()
  return useMutation({
    mutationFn: async () => {
      if (!VAPID_PUBLIC_KEY) throw new Error('Notifications are not configured for this app yet.')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error(
          'Notifications are blocked for this site. Allow them in the browser’s site settings, then try again.',
        )
      }
      const registration = await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }))
      const keys = subscription.toJSON().keys
      if (!keys?.p256dh || !keys.auth) throw new Error('The browser returned an incomplete subscription.')

      const { error } = await supabase.rpc('register_push_subscription', {
        p_endpoint: subscription.endpoint,
        p_p256dh: keys.p256dh,
        p_auth: keys.auth,
        p_device_label: await describeThisDevice(),
      })
      if (error) {
        await subscription.unsubscribe()
        throw error
      }
    },
    onSettled: invalidate,
  })
}

// Removes a registered device. If it's this browser, also unsubscribes
// locally so the push service stops accepting messages for it.
export function useRemoveDevice() {
  const invalidate = useInvalidatePush()
  return useMutation({
    mutationFn: async (device: Pick<RegisteredDevice, 'id' | 'endpoint'>) => {
      const { error } = await supabase.from('push_subscriptions').delete().eq('id', device.id)
      if (error) throw error
      if (pushSupported) {
        const subscription = await currentSubscription()
        if (subscription?.endpoint === device.endpoint) await subscription.unsubscribe()
      }
    },
    onSettled: invalidate,
  })
}

export function useSendTestPush() {
  return useMutation({
    mutationFn: async (endpoint: string) => {
      const { data, error } = await supabase.functions.invoke('send-push', { body: { endpoint } })
      if (error) {
        // A non-2xx response's own { error } message is more useful than
        // supabase-js's generic "returned a non-2xx status code".
        const body = await (error.context as Response | undefined)?.json?.().catch(() => null)
        throw new Error(body?.error ?? error.message)
      }
      if (!data?.delivered) throw new Error('The test notification could not be delivered.')
    },
  })
}
