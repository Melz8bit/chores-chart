import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Fixed ports so this project doesn't collide with other Vite projects on
  // the default 5173/4173; strictPort fails loudly instead of silently
  // picking the next free port.
  server: { port: 5181, strictPort: true },
  preview: { port: 4181, strictPort: true },
})
