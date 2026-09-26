// Copies pdf.js runtime data (CMaps for CJK text, standard fonts, image-decoder
// WASM, ICC profiles) into public/ so the static site can serve them.
// pdf.js fetches these only when a document needs them.
import { cpSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = `${root}public/pdfjs`
rmSync(out, { recursive: true, force: true })
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  cpSync(`${root}node_modules/pdfjs-dist/${dir}`, `${out}/${dir}`, { recursive: true })
}
