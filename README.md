# Folio

**Every PDF tool. Private by design.**

Folio is a free, Apple-style PDF toolkit that runs entirely in your browser: sign, fill forms,
merge, split, compress, convert and more. Files are processed on your device and never uploaded.

## Tools

All 22 tools work entirely in the browser:

| Category | Tools |
| --- | --- |
| Sign & Fill | Sign PDF (draw / type / upload, saved signatures), Fill PDF Form (lock fields option) |
| Organize | Merge, Split, Organize Pages (multi-file, drag to reorder), Remove Pages, Extract Pages, Rotate |
| Optimize | Compress (keeps text selectable; Extreme rasterizes), OCR (self-hosted Tesseract, English), Repair |
| Convert | Image to PDF, PDF to Image (JPG/PNG, 72–300 dpi), Scan to PDF (camera + document filter) |
| Edit | Edit PDF (text, images, whiteout, highlight), Watermark, Page Numbers, Crop |
| Security | Protect (AES-256), Unlock, Redact (true redaction: pages are flattened), Compare |

Not included, because they'd need a server: inviting others to sign, Office ↔ PDF conversion, AI features.

### Workspace shortcuts

| Keys | Action |
| --- | --- |
| `T` | Add text |
| `⌘Z` / `⇧⌘Z` | Undo / redo |
| `⌫` | Delete selection |
| Arrow keys (`⇧` for 10×) | Nudge selection |
| `⌘+` / `⌘−` / `⌘0` | Zoom in / out / fit width |
| `⌘S` | Download |

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run lint
npm test         # unit tests (Vitest)
npm run test:e2e # browser tests (Playwright, uses your installed Chrome)
```

## Deploy

Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Live at **https://folio.devops-monk.com/** (custom domain via `public/CNAME`; DNS has a
`CNAME folio → devops-monk.github.io` record). The app uses a relative base path and hash
routing (`#/sign-pdf`), so it also works at `https://devops-monk.github.io/folio/`.

## Tech

Vite · React 19 · TypeScript · React Router · Zustand · Lucide icons.
Planned: pdf.js, @cantoo/pdf-lib, qpdf-wasm, tesseract.js (all client-side).
