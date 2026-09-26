/**
 * Browser-only engines that need rendering (pdf.js + canvas): export to
 * images, compression, repair and rasterizing pages.
 */
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  type PDFDocument as PDFDoc,
} from '@cantoo/pdf-lib'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { openPdf } from '../workspace/pdf'
import { loadPdf } from './load'

export type Progress = (fraction: number, label?: string) => void

export async function withPdfjs<T>(bytes: Uint8Array, fn: (pdf: PDFDocumentProxy) => Promise<T>): Promise<T> {
  const task = await openPdf(bytes)
  try {
    return await fn(await task.promise)
  } finally {
    task.destroy()
  }
}

/** Renders a page (as displayed, rotation applied) at `scale` CSS px per point. */
export async function renderPage(pdf: PDFDocumentProxy, index: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(index + 1)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, viewport, background: 'white' }).promise
  page.cleanup()
  return canvas
}

export async function canvasBytes(canvas: HTMLCanvasElement, type: 'image/jpeg' | 'image/png', quality = 0.9) {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image encoding failed'))), type, quality),
  )
  return new Uint8Array(await blob.arrayBuffer())
}

export interface ImageOutput {
  name: string
  bytes: Uint8Array
  type: string
}

export async function pdfToImages(
  bytes: Uint8Array,
  baseName: string,
  o: { format: 'jpg' | 'png'; dpi: number; pages?: number[] },
  progress: Progress,
): Promise<ImageOutput[]> {
  return withPdfjs(bytes, async (pdf) => {
    const pages = o.pages ?? Array.from({ length: pdf.numPages }, (_, i) => i)
    const out: ImageOutput[] = []
    const pad = String(pdf.numPages).length
    for (const [k, i] of pages.entries()) {
      progress(k / pages.length, `Page ${i + 1} of ${pdf.numPages}`)
      const canvas = await renderPage(pdf, i, o.dpi / 72)
      const type = o.format === 'png' ? 'image/png' : 'image/jpeg'
      out.push({
        name: `${baseName}-${String(i + 1).padStart(pad, '0')}.${o.format}`,
        bytes: await canvasBytes(canvas, type, 0.92),
        type,
      })
    }
    progress(1)
    return out
  })
}

/** Builds a PDF whose pages are the given JPEGs, each at its page's display size in points. */
async function imagePagesPdf(pages: { jpg: Uint8Array; width: number; height: number }[]) {
  const doc = await PDFDocument.create()
  for (const p of pages) {
    const img = await doc.embedJpg(p.jpg)
    doc.addPage([p.width, p.height]).drawImage(img, { x: 0, y: 0, width: p.width, height: p.height })
  }
  return doc
}

/** Turns every page into an image. Used by extreme compression and as a last-resort repair. */
export async function rasterizeAll(bytes: Uint8Array, dpi: number, quality: number, progress: Progress) {
  return withPdfjs(bytes, async (pdf) => {
    const pages = []
    for (let i = 0; i < pdf.numPages; i++) {
      progress(i / pdf.numPages, `Page ${i + 1} of ${pdf.numPages}`)
      const canvas = await renderPage(pdf, i, dpi / 72)
      const vp = (await pdf.getPage(i + 1)).getViewport({ scale: 1 })
      pages.push({ jpg: await canvasBytes(canvas, 'image/jpeg', quality), width: vp.width, height: vp.height })
    }
    progress(1)
    return (await imagePagesPdf(pages)).save()
  })
}

/* ─── Compression ─────────────────────────────────────────────── */

export type CompressLevel = 'low' | 'recommended' | 'extreme'

const LEVELS: Record<CompressLevel, { maxSide: number; quality: number }> = {
  low: { maxSide: 2400, quality: 0.82 },
  recommended: { maxSide: 1600, quality: 0.7 },
  extreme: { maxSide: 1100, quality: 0.55 },
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Reverses PNG row filters (PDF /Predictor ≥ 10). */
function unpredictPng(data: Uint8Array, rowBytes: number, bpp: number): Uint8Array {
  const rows = Math.floor(data.length / (rowBytes + 1))
  const out = new Uint8Array(rows * rowBytes)
  for (let r = 0; r < rows; r++) {
    const f = data[r * (rowBytes + 1)]
    const src = r * (rowBytes + 1) + 1
    const dst = r * rowBytes
    for (let i = 0; i < rowBytes; i++) {
      const x = data[src + i]
      const a = i >= bpp ? out[dst + i - bpp] : 0
      const b = r > 0 ? out[dst - rowBytes + i] : 0
      const c = r > 0 && i >= bpp ? out[dst - rowBytes + i - bpp] : 0
      let v = x
      if (f === 1) v = x + a
      else if (f === 2) v = x + b
      else if (f === 3) v = x + ((a + b) >> 1)
      else if (f === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      }
      out[dst + i] = v & 255
    }
  }
  return out
}

function componentCount(doc: PDFDoc, cs: unknown): number | null {
  if (cs === PDFName.of('DeviceRGB')) return 3
  if (cs === PDFName.of('DeviceGray')) return 1
  if (cs instanceof PDFArray && cs.get(0) === PDFName.of('ICCBased')) {
    const icc = doc.context.lookup(cs.get(1))
    const n = icc instanceof PDFRawStream ? icc.dict.lookup(PDFName.of('N')) : undefined
    const count = n instanceof PDFNumber ? n.asNumber() : null
    return count === 1 || count === 3 ? count : null
  }
  return null
}

/** Decodes an image XObject we know how to handle into a bitmap, or null to leave it alone. */
async function decodeImage(doc: PDFDoc, stream: PDFRawStream): Promise<ImageBitmap | null> {
  const d = stream.dict
  const w = d.lookup(PDFName.of('Width'), PDFNumber).asNumber()
  const h = d.lookup(PDFName.of('Height'), PDFNumber).asNumber()
  if (d.has(PDFName.of('ImageMask')) || d.has(PDFName.of('Mask')) || d.has(PDFName.of('Decode'))) return null
  const bpc = d.lookup(PDFName.of('BitsPerComponent'))
  if (!(bpc instanceof PDFNumber) || bpc.asNumber() !== 8) return null
  const comps = componentCount(doc, d.lookup(PDFName.of('ColorSpace')))
  if (!comps) return null

  let filter = d.lookup(PDFName.of('Filter'))
  if (filter instanceof PDFArray && filter.size() === 1) filter = filter.lookup(0)

  if (filter === PDFName.of('DCTDecode')) {
    return createImageBitmap(new Blob([stream.contents as BlobPart], { type: 'image/jpeg' }))
  }
  if (filter !== PDFName.of('FlateDecode')) return null

  let raw = await inflate(stream.contents)
  const parms = d.lookup(PDFName.of('DecodeParms'))
  const predictor = parms instanceof PDFDict ? parms.lookup(PDFName.of('Predictor')) : undefined
  const pred = predictor instanceof PDFNumber ? predictor.asNumber() : 1
  if (pred >= 10) raw = unpredictPng(raw, w * comps, comps)
  else if (pred !== 1) return null
  if (raw.length < w * h * comps) return null

  const rgba = new Uint8ClampedArray(w * h * 4)
  for (let i = 0, j = 0; i < w * h; i++, j += comps) {
    rgba[i * 4] = raw[j]
    rgba[i * 4 + 1] = comps === 3 ? raw[j + 1] : raw[j]
    rgba[i * 4 + 2] = comps === 3 ? raw[j + 2] : raw[j]
    rgba[i * 4 + 3] = 255
  }
  return createImageBitmap(new ImageData(rgba, w, h))
}

/** Re-encodes large photos/screenshots as smaller JPEGs. Text and vector content are untouched. */
async function recompressImages(doc: PDFDoc, level: CompressLevel, progress: Progress) {
  const { maxSide, quality } = LEVELS[level]
  const images = doc.context
    .enumerateIndirectObjects()
    .filter(([, o]) => o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) as [
    PDFRef,
    PDFRawStream,
  ][]

  for (const [k, [ref, stream]] of images.entries()) {
    progress(k / Math.max(1, images.length), `Image ${k + 1} of ${images.length}`)
    if (stream.contents.length < 20_000) continue // small images aren't worth it
    let bitmap: ImageBitmap | null = null
    try {
      bitmap = await decodeImage(doc, stream)
    } catch {
      bitmap = null
    }
    if (!bitmap) continue
    const k2 = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * k2))
    canvas.height = Math.max(1, Math.round(bitmap.height * k2))
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const jpg = await canvasBytes(canvas, 'image/jpeg', quality)
    if (jpg.length > stream.contents.length * 0.9) continue

    const dict = doc.context.obj({
      Type: 'XObject',
      Subtype: 'Image',
      Width: canvas.width,
      Height: canvas.height,
      ColorSpace: 'DeviceRGB',
      BitsPerComponent: 8,
      Filter: 'DCTDecode',
      Length: jpg.length,
    })
    const smask = stream.dict.get(PDFName.of('SMask'))
    if (smask) dict.set(PDFName.of('SMask'), smask)
    doc.context.assign(ref, PDFRawStream.of(dict, jpg))
  }
}

export interface CompressResult {
  bytes: Uint8Array
  /** True when the output would have been bigger, so the original is returned. */
  unchanged: boolean
}

export async function compressPdf(input: Uint8Array, level: CompressLevel, progress: Progress): Promise<CompressResult> {
  let out: Uint8Array
  if (level === 'extreme') {
    out = await rasterizeAll(input, 110, LEVELS.extreme.quality, progress)
  } else {
    const doc = await loadPdf(input)
    await recompressImages(doc, level, progress)
    progress(0.95, 'Saving')
    out = await doc.save({ useObjectStreams: true })
  }
  progress(1)
  return out.length < input.length ? { bytes: out, unchanged: false } : { bytes: input, unchanged: true }
}

/* ─── Repair ──────────────────────────────────────────────────── */

export async function repairPdf(input: Uint8Array, progress: Progress): Promise<{ bytes: Uint8Array; method: 'rebuilt' | 'rasterized' }> {
  progress(0.1, 'Rebuilding document structure')
  try {
    const doc = await PDFDocument.load(input.slice(), { ignoreEncryption: false, throwOnInvalidObject: false, updateMetadata: false })
    if (doc.getPageCount() > 0) {
      // Round-trip through a fresh document drops broken objects and rebuilds the xref table.
      const fresh = await PDFDocument.create()
      const pages = await fresh.copyPages(doc, doc.getPageIndices())
      pages.forEach((p) => fresh.addPage(p))
      progress(1)
      return { bytes: await fresh.save(), method: 'rebuilt' }
    }
  } catch {
    // pdf.js is far more tolerant of damage; fall back to re-rendering the pages.
  }
  progress(0.2, 'Recovering pages')
  const bytes = await rasterizeAll(input, 150, 0.85, (f, l) => progress(0.2 + f * 0.8, l))
  return { bytes, method: 'rasterized' }
}
