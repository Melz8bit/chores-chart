// Service worker: only handles Web Push for now (no offline caching).
// Payloads come from the send-push Edge Function as JSON:
//   { title, body, url?, tag? }

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Chores Chart', {
      body: data.body || '',
      icon: '/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  )
})

// Tapping a notification focuses an already-open app window (navigating it to
// the notification's page) or opens a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then((focused) => focused.navigate(url))
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
