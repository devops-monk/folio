/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base + HashRouter lets the build run from any GitHub Pages path
// (username.github.io/<repo>/) or a custom domain without reconfiguring.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // pdf-lib and pdf.js are large but lazy-loaded only when a tool needs them.
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
