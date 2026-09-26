// Copies runtime data that libraries fetch on demand into public/, so the
// static site serves everything itself (no CDN, works offline):
// - pdf.js: CMaps for CJK text, standard fonts, image-decoder WASM, ICC profiles
// - tesseract.js (OCR): worker, WASM cores, English model
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const nm = `${root}node_modules`

const pdfjs = `${root}public/pdfjs`
rmSync(pdfjs, { recursive: true, force: true })
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  cpSync(`${nm}/pdfjs-dist/${dir}`, `${pdfjs}/${dir}`, { recursive: true })
}

const ocr = `${root}public/ocr`
rmSync(ocr, { recursive: true, force: true })
mkdirSync(`${ocr}/core`, { recursive: true })
mkdirSync(`${ocr}/lang`, { recursive: true })
cpSync(`${nm}/tesseract.js/dist/worker.min.js`, `${ocr}/worker.min.js`)
for (const v of ['lstm', 'simd-lstm', 'relaxedsimd-lstm']) {
  cpSync(`${nm}/tesseract.js-core/tesseract-core-${v}.wasm.js`, `${ocr}/core/tesseract-core-${v}.wasm.js`)
}
cpSync(`${nm}/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz`, `${ocr}/lang/eng.traineddata.gz`)
