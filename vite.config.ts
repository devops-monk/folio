import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base + HashRouter lets the build run from any GitHub Pages path
// (username.github.io/<repo>/) or a custom domain without reconfiguring.
export default defineConfig({
  base: './',
  plugins: [react()],
})
