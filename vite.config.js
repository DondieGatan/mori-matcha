import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8092,
  },
  build: {
    rollupOptions: {
      // Two HTML entries so /party-cart has its own title and share-preview tags
      // (link previews read the static HTML, not the React-rendered page).
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        partyCart: resolve(import.meta.dirname, 'party-cart.html'),
      },
    },
  },
})
