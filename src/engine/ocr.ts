/** OCR: adds an invisible, searchable text layer to scanned pages (browser-only). */
import { StandardFonts } from '@cantoo/pdf-lib'
import { loadPdf } from './load'
import { displayDraw } from './stamp'
import { renderPage, withPdfjs, type Progress } from './raster'

const OCR_DPI = 200

interface Word {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

interface OcrBlock {
  paragraphs: { lines: { words: Word[] }[] }[]
}

const asset = (p: string) => new URL(p, document.baseURI).href

export async function ocrPdf(input: Uint8Array, skipTextPages: boolean, progress: Progress): Promise<{ bytes: Uint8Array; pagesDone: number }> {
  progress(0, 'Loading text recognition')
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    workerPath: asset('ocr/worker.min.js'),
    corePath: asset('ocr/core'),
    langPath: asset('ocr/lang'),
  })

  try {
    const doc = await loadPdf(input)
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const pages = doc.getPages()
    let pagesDone = 0

    await withPdfjs(input, async (pdf) => {
      for (let i = 0; i < pdf.numPages; i++) {
        const label = `Reading page ${i + 1} of ${pdf.numPages}`
        progress(0.05 + (i / pdf.numPages) * 0.9, label)
        if (skipTextPages) {
          const text = await (await pdf.getPage(i + 1)).getTextContent()
          if (text.items.some((it) => 'str' in it && it.str.trim())) continue
        }
        const scale = OCR_DPI / 72
        const canvas = await renderPage(pdf, i, scale)
        const { data } = await worker.recognize(canvas, {}, { blocks: true })
        const d = displayDraw(pages[i])

        for (const block of (data.blocks ?? []) as unknown as OcrBlock[]) {
          for (const para of block.paragraphs) {
            for (const line of para.lines) {
              for (const word of line.words) {
                const text = word.text.replace(/[^\x20-\x7e -ÿ]/g, '')
                if (!text.trim()) continue
                const w = (word.bbox.x1 - word.bbox.x0) / scale
                const h = (word.bbox.y1 - word.bbox.y0) / scale
                const unit = font.widthOfTextAtSize(text, 1)
                const size = Math.max(1, Math.min(h * 1.2, unit > 0 ? w / unit : h))
                // Baseline sits slightly above the word box bottom (descenders).
                const p = d.at(word.bbox.x0 / scale, word.bbox.y1 / scale - h * 0.18)
                pages[i].drawText(text, { ...p, size, font, opacity: 0, rotate: d.rotate() })
              }
            }
          }
        }
        pagesDone++
      }
    })
    progress(0.97, 'Saving')
    const bytes = await doc.save()
    progress(1)
    return { bytes, pagesDone }
  } finally {
    await worker.terminate()
  }
}
