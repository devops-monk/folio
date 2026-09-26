# Folio

**Every PDF tool. Private by design.**

Folio is a free, Apple-style PDF toolkit that runs entirely in your browser: sign, fill forms,
merge, split, compress, convert and more. Files are processed on your device and never uploaded.

## Status

Milestone 1 (scaffold) is done: design system, tool catalog, home page, tool pages with
drag-and-drop, light/dark theme and GitHub Pages deployment. The tools themselves land in the
following milestones. See [PLAN.md](PLAN.md) for the full roadmap.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run lint
```

## Deploy

Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The app uses a relative base path and hash routing (`#/sign-pdf`), so it works at
`https://<user>.github.io/folio/` or on a custom domain with no config changes.

## Tech

Vite · React 19 · TypeScript · React Router · Zustand · Lucide icons.
Planned: pdf.js, @cantoo/pdf-lib, qpdf-wasm, tesseract.js (all client-side).
