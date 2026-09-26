# PLAN — "Folio": a private, Apple-style PDF toolkit on GitHub Pages


## Context
The goal is an iLovePDF-style site (reference: https://www.ilovepdf.com/sign-pdf) that covers sign, fill forms, split, merge, compress and the rest. It will be hosted free on **GitHub Pages**, so there is **no server** and every PDF operation runs in the user's browser. That is also the selling point: *"Your files never leave your device."* The UI should feel like a native Apple app.

The folder contains 7 reference repos. What we learned from them:

| Repo | License | Useful for | Reuse code? |
|---|---|---|---|
| `pdf-pro` | MIT | Vite + React + GitHub Pages deploy workflow, pdf.js worker setup, lazy OCR (tesseract.js), PWA/service worker, drag-and-drop uploader | ✅ Setup and patterns. Its compress and password features are **fake** (pdf-lib 1.17 cannot encrypt), so don't copy those |
| `pdf-editor` (Svelte) | MIT | Editable overlay object model flattened on save (`src/utils/PDF.js`), vector signatures via `drawSvgPath`, touch pan/resize (`src/utils/pannable.js`) | ✅ Port the ideas and logic to React |
| `pdf-toolkit` (Flask) | MIT | Editor JS (`static/js/editor.js`: percent-based positions, pointer drag/resize, undo snapshots); compression strategy (lossless first, then rasterize at 96/150/200 DPI with JPEG quality 60/75/85); real redaction by rasterizing; signature background removal by ink-threshold | ✅ Algorithms and JS |
| `Stirling-PDF` | MIT core + **proprietary** parts, and `frontend/package.json` points to the proprietary license | Most complete tool catalog, tool-registry pattern (`ADDING_TOOLS.md`), workbench modes, multi-file page grid color-coded by file, saved signatures, phone signing via QR, form-fill overlay | ⚠️ Ideas only; don't copy code |
| `KillerPDF` (C# WPF) | **GPL-3** | Theme system (neutral base plus a swappable accent, as CSS variables), per-tab undo, shortcut overlay, rasterize-flatten, page compare | ⚠️ Ideas only |
| `PDF-Verse` | Unclear (ISC, no LICENSE file) | Needs a server for everything; flattens pages to images on export | ❌ Avoid |
| `1pdf-guide` | CC-BY-4.0 (docs) | `data/tools.json` (86-tool catalog as a roadmap), `docs/privacy-model.md` wording, recipes | ✅ As a checklist |

## Name
**Folio** (folio.app style; the repo would be `folio-pdf`). *Folio* means a sheet of paper or a page. It is short, sounds Apple-like, and is easy to say.
Alternatives: **Sheaf**, **Papyr**, **Inkwell**, **Quire** (a quire is a gathering of pages).
*Before committing, check GitHub, npm and domain availability and do a quick trademark search.*

## Tech stack (all static and client-side)
- **Vite + React 19 + TypeScript**, with `base: '/<repo>/'`. Use **HashRouter**, or `404.html` redirect trick from `pdf-pro/public/404.html`, so deep links work on Pages.
- **pdfjs-dist ≥ 4** for rendering, thumbnails, text layer and form-field reading. It runs in its own worker.
- **@cantoo/pdf-lib** for writing: merge, split, embed, forms, and **real encryption**. It is a pdf-lib fork that adds encryption.
- **qpdf-wasm** (Apache-2), lazy-loaded: lossless compression (object streams, dedupe), decrypt/unlock, repair, linearize.
- **tesseract.js**, lazy-loaded: OCR into an invisible text layer.
- **signature_pad** for drawing; **@dnd-kit** for page reordering; **jszip** for downloading several files; **idb-keyval** for IndexedDB.
- **Zustand** for state, with an undo/redo command stack.
- **Comlink + Web Workers** so heavy work (compress, rasterize, OCR) never freezes the UI.
- **vite-plugin-pwa** so the app works offline and can be installed.
- Avoid **mupdf.js** because it is AGPL and would force the whole app to be AGPL.

## Architecture
```
src/
  app/            shell, router, theme, command palette
  engine/         pure functions: (files: Uint8Array[], params) => Promise<Uint8Array[]>
    merge.ts split.ts rotate.ts compress.ts sign.ts forms.ts redact.ts ...
  workers/        engine.worker.ts (Comlink), ocr.worker.ts
  tools/          registry.ts + one folder per tool (Settings panel, lazy loaded)
  workspace/      Viewer, PageGrid (thumbnails), OverlayLayer (editable objects)
  components/ui/  Apple-style primitives (Button, Segmented, Sheet, Popover, Toolbar, Sidebar)
  store/          documents, overlays, history (undo/redo), signatures (IndexedDB)
```
- **Tool registry** (adapted from Stirling's idea): `{ id, name, icon, category, synonyms, accepts, maxFiles, Settings: lazy(), run: engineFn }`. The home grid, search and command palette all read from it, and since every `run` is a pure function, tools can be **chained** later.
- **Overlay object model** (from pdf-editor and pdf-toolkit): signatures, text, images, shapes and form values are kept as editable objects with page-relative (percentage) coordinates. They are only flattened with pdf-lib on **Download**. This makes undo/redo, move and resize, and "apply to all pages" straightforward.

## Feature roadmap (matching iLovePDF)

### Phase 1 — MVP (core plus the Sign flow)
- **Sign PDF**, matching iLovePDF:
  - Create a signature by **Draw** (color and thickness), **Type** (~8 script fonts from Google Fonts, bundled locally), **Upload** (PNG/JPG/SVG, with automatic background removal using an ink threshold), or **Draw on phone** (scan a QR code and draw on your phone. This needs WebRTC via PeerJS's public broker, so it is optional and comes last).
  - **Initials** and **Company stamp** (upload).
  - Fields: **Date** (format picker), **Name**, **Text**, **Checkmark**.
  - Placement: drag, resize and snap; apply to **this page / all pages / all but last / last page / custom range**.
  - Saved signatures kept in IndexedDB on this device only.
  - Optional "signing summary" page with timestamp, SHA-256 of the original file and a UUID. It is clearly labeled as **not** a legally certified signature.
  - Out of scope: the "several people" invite flow, which needs a backend for email and state.
- **Fill PDF forms**: read AcroForm fields with pdf.js and draw native-looking inputs over them; write the values back with pdf-lib; offer an optional **Flatten**. For PDFs without fields, fall back to "Add text" overlays.
- **Organize**: Merge, Split (by range, every N pages, or extract selected), Remove pages, Extract pages, Reorder (drag thumbnails), Rotate. A multi-file page grid with color coding by file.
- **Convert**: JPG/PNG to PDF, PDF to JPG/PNG (as a zip).

### Phase 2 — Optimize & Edit
- **Compress**: Low / Recommended / Extreme. Lossless qpdf pass first; if that saves under 2%, rasterize pages at 96/150/200 DPI with JPEG quality 60/75/85 in a worker. Show "Saved 64% · 12.4 MB → 4.5 MB".
- **Edit / Annotate**: text boxes, images, freehand, highlight, shapes, whiteout.
- **Watermark** (text or image, opacity, tiling), **Page numbers** (position and format), **Crop**, **Add blank page**.
- **OCR** with tesseract.js (makes scans searchable).

### Phase 3 — Security & extras
- **Protect** (password with AES-256 via @cantoo/pdf-lib) and **Unlock** (qpdf, when the user knows the password).
- **Redact**: mark areas, then rasterize the affected pages so the text is really gone (pdf-toolkit approach), and strip metadata.
- **Compare**: diff the text layers and pixels (pixelmatch) side by side.
- **Metadata editor**, **Flatten**, **Repair**, **N-up / Booklet**, **Scan to PDF** (camera plus perspective crop).
- Later or limited: Word/PPT/Excel conversion (LibreOffice WASM is ~50 MB, which is too heavy; at most offer PDF to text/Markdown), AI summarize (would need an API key, so it conflicts with the privacy promise).

## UX & Apple-style design
- **Home**: a large-title header ("Every PDF tool. Private by design."), a search field, and a grid of tool tiles grouped as *Organize · Optimize · Convert · Edit · Sign · Security*, each tile with an SF-Symbols-style icon (Lucide) in a tinted rounded square.
- **Tool flow** in 3 calm steps: **Drop** (full-window drop zone, paste, or file picker) → **Workspace** (a translucent sidebar of page thumbnails on the left, the canvas in the center, an inspector panel on the right with the tool settings) → **Done** sheet (Download, Share with `navigator.share`, "Continue with another tool" which carries the file forward).
- **Visual language**:
  - Fonts: `-apple-system, "SF Pro", Inter` fallback.
  - 8-pt spacing grid; corner radius 10/14/20.
  - Frosted toolbars (`backdrop-filter: blur(20px) saturate(180%)`), hairline 0.5px separators, soft layered shadows.
  - Colors: systemBlue accent `#0A84FF`, grouped backgrounds `#F2F2F7` / dark `#000`/`#1C1C1E`. Light and dark follow `prefers-color-scheme`, and the accent is a swappable CSS variable (KillerPDF's pattern).
  - Motion: spring animations (Framer Motion) for sheets, popovers and reordering; honor `prefers-reduced-motion`.
- **Controls**: segmented controls, iOS-style switches, bottom sheets on mobile, popovers on desktop, and a **⌘K command palette** plus a **?** shortcut overlay. Undo/redo with ⌘Z / ⇧⌘Z.
- **Trust cues**: a "🔒 Processed on your device" badge on every tool, and a clear privacy page (use `1pdf-guide/docs/privacy-model.md` as a model).
- **Performance**: pdf.js and tools load only when needed, thumbnails render progressively (IntersectionObserver), heavy work runs in workers with a progress bar and cancel. Target Lighthouse ≥ 95 on the home page.
- **Accessibility**: full keyboard navigation, ARIA roles on the canvas objects, WCAG AA contrast, focus rings.
- **Mobile first**: touch drag and resize (pointer events), pinch zoom, bottom toolbar.

## Deployment (GitHub Pages)
- `.github/workflows/deploy.yml`: `npm ci → npm run build → actions/upload-pages-artifact → actions/deploy-pages`. Start from `pdf-pro/.github/workflows/deploy.yml`.
- `vite.config.ts` `base` set to the repo name, or `/` for a custom domain with a `CNAME`.
- GitHub Pages can't set custom headers, so skip SharedArrayBuffer-dependent WASM builds, or use the `coi-serviceworker` shim if one is needed.
- WASM and fonts are served from our own origin, with no CDN at runtime (pdf-editor loads its libraries from unpkg; don't).
- SEO: one route and meta tags per tool (e.g. `#/sign-pdf`), plus an optional prerendered landing page per tool, `sitemap.xml` and `robots.txt`.

## Milestones
1. Scaffold: Vite, TS, design tokens, UI primitives, home grid, tool registry, Pages deploy.
2. Workspace: viewer, thumbnail sidebar, overlay layer, undo/redo, download.
3. Sign PDF (full flow) and Fill forms.
4. Merge / Split / Organize / Rotate / Image↔PDF.
5. Compress, Watermark, Page numbers, Edit/annotate, OCR.
6. Protect/Unlock, Redact, Compare, PWA polish, i18n.

## Verification
- Unit tests (Vitest) for each `engine/*` function, using fixture PDFs: plain, AcroForm, encrypted, scanned, 200 pages. Examples: split page counts, merged order, form values survive a pdf.js reload, compressed output is smaller, redacted text can't be extracted.
- End-to-end tests (Playwright): drop a file, sign it, download it, and check the downloaded file's page count and that the signature image object exists; also run the mobile viewport.
- Manual checks: open outputs in Apple Preview, Acrobat Reader and Chrome; test on iPhone Safari; Lighthouse audit; with the browser offline (PWA), confirm tools still work, and confirm no network requests are made during processing (DevTools).
