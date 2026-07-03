import { twemojiUrl } from '../lib/twemoji'

// Renders emoji as bundled Twemoji SVGs instead of each device's native
// emoji font, so glyphs look identical (and land in the same visual center)
// on every OS. Falls back to the raw glyph if the parser doesn't recognize
// it as emoji.
export function Emoji({
  emoji,
  fallback = '🙂',
  className = 'h-[1em] w-[1em]',
}: {
  emoji: string | null
  fallback?: string
  className?: string
}) {
  const glyph = emoji || fallback
  const url = twemojiUrl(glyph)

  if (!url) {
    return <span className={className}>{glyph}</span>
  }

  return <img src={url} alt="" draggable={false} className={`inline-block ${className}`} />
}
