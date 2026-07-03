import { parse } from '@twemoji/parser'

// Resolves a native emoji glyph to its bundled Twemoji SVG (see
// scripts/copy-emoji-assets.mjs). Returns null for characters the parser
// doesn't recognize as emoji, so callers can fall back to the raw glyph.
export function twemojiUrl(emoji: string): string | null {
  const [entity] = parse(emoji)
  if (!entity) return null
  const filename = entity.url.slice(entity.url.lastIndexOf('/') + 1)
  return `/emoji/${filename}`
}

// emoji-picker-react identifies emoji by a hyphen-joined hex codepoint
// string (its `unified` field) rather than the glyph itself — convert back
// to a real glyph so it can go through the same twemojiUrl() lookup as
// everywhere else in the app.
export function unifiedToEmoji(unified: string): string {
  return String.fromCodePoint(...unified.split('-').map((codepoint) => parseInt(codepoint, 16)))
}
