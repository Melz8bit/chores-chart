// Vendors the @twemoji/svg asset set into public/emoji/ so the app can
// render emoji as bundled, pre-centered SVGs instead of relying on each
// device's native emoji font (which render the same glyph with different
// internal vertical padding across OSes). Runs on `npm install` so the
// assets are always present without committing ~3700 files to git.
import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const src = path.join(rootDir, 'node_modules', '@twemoji', 'svg')
const dest = path.join(rootDir, 'public', 'emoji')

await rm(dest, { recursive: true, force: true })
await mkdir(dest, { recursive: true })

const entries = await readdir(src, { withFileTypes: true })
await Promise.all(
  entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.svg'))
    .map((entry) => cp(path.join(src, entry.name), path.join(dest, entry.name))),
)

console.log(`Copied ${entries.length} emoji SVGs to public/emoji/`)
