/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base is './' so the production build works when hosted under a sub-path
// (e.g. GitHub Pages at /WMS/).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
