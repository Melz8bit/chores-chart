import { lazy, Suspense, useState } from 'react'
import type { EmojiClickData, EmojiStyle } from 'emoji-picker-react'
import { Emoji } from './Emoji'
import { twemojiUrl, unifiedToEmoji } from '../lib/twemoji'

// The emoji dataset is a few hundred KB — load it only when someone actually
// opens the picker, not as part of the initial app bundle (this app boots as
// a kiosk that should be fast to load).
const LazyEmojiPickerReact = lazy(() => import('emoji-picker-react'))

// Render the picker with the same bundled Twemoji SVGs used everywhere else
// in the app (see src/lib/twemoji.ts), instead of the library's default of
// native OS glyphs or a CDN-hosted image set — keeps the picker fully
// offline-capable and visually identical to what gets rendered after
// picking.
function getEmojiUrl(unified: string) {
  return twemojiUrl(unifiedToEmoji(unified)) ?? ''
}

export function EmojiPicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (emoji: string) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)

  function handlePick(data: EmojiClickData) {
    onChange(data.emoji)
    setOpen(false)
  }

  return (
    <div>
      {label && <span className="block text-sm text-slate-700 mb-1">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-10.5 w-16 flex items-center justify-center rounded-lg border border-slate-300 bg-white"
      >
        <Emoji emoji={value || null} fallback="➕" className="h-6 w-6" />
      </button>

      {open && (
        <div className="mt-2">
          <Suspense
            fallback={<p className="py-8 text-center text-sm text-slate-400">Loading emojis…</p>}
          >
            <LazyEmojiPickerReact
              onEmojiClick={handlePick}
              emojiStyle={'twitter' as EmojiStyle}
              getEmojiUrl={getEmojiUrl}
              autoFocusSearch={false}
              width="100%"
              height={350}
              previewConfig={{ showPreview: false }}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}
