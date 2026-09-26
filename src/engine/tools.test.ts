import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts, degrees } from '@cantoo/pdf-lib'
import {
  assemble,
  chunkPages,
  describeGroup,
  keepPages,
  mergePdfs,
  parseRanges,
  removePages,
  rotatePages,
  splitPdf,
} from './pages'
import { addPageNumbers, addWatermark, cropPages } from './stamp'
import { imagesToPdf } from './images'
import { deflateSync } from 'node:zlib'

/** PDF whose pages say "A1", "A2"... so order can be checked by text. */
async function labeled(prefix: string, n: number, size: [number, number] = [612, 792]) {
  const d = await PDFDocument.create()
  const f = await d.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= n; i++) d.addPage(size).drawText(`${prefix}${i}`, { x: 50, y: 50, size: 20, font: f })
  return d.save()
}

async function texts(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: bytes.slice(), standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise
  const out: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent()
    out.push(c.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim())
  }
  return out
}

describe('parseRanges', () => {
  it('parses singles, ranges and open ends', () => {
    expect(parseRanges('1-3, 5, 8-', 10)).toEqual([[0, 1, 2], [4], [7, 8, 9]])
    expect(parseRanges('-2', 5)).toEqual([[0, 1]])
    expect(parseRanges(' 2–4 ', 5)).toEqual([[1, 2, 3]])
  })
  it('rejects bad input with helpful messages', () => {
    expect(() => parseRanges('', 5)).toThrow(/at least one/)
    expect(() => parseRanges('0', 5)).toThrow(/outside 1–5/)
    expect(() => parseRanges('4-2', 5)).toThrow(/backwards/)
    expect(() => parseRanges('abc', 5)).toThrow(/isn’t a page/)
    expect(() => parseRanges('3-9', 5)).toThrow(/outside/)
  })
  it('chunks and describes groups', () => {
    expect(chunkPages(5, 2)).toEqual([[0, 1], [2, 3], [4]])
    expect(describeGroup([0, 1, 2])).toBe('1–3')
    expect(describeGroup([4])).toBe('5')
  })
})

describe('page operations', () => {
  it('merges in order', async () => {
    expect(await texts(await mergePdfs([await labeled('A', 2), await labeled('B', 1)]))).toEqual(['A1', 'A2', 'B1'])
  })

  it('assembles across files with reorder, duplicates and rotation', async () => {
    const out = await assemble([await labeled('A', 2), await labeled('B', 2)], [
      { file: 1, page: 1 },
      { file: 0, page: 0, rotate: 90 },
      { file: 0, page: 0 },
    ])
    expect(await texts(out)).toEqual(['B2', 'A1', 'A1'])
    const doc = await PDFDocument.load(out)
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 0])
  })

  it('keeps, removes, splits and rotates', async () => {
    const src = await labeled('P', 5)
    expect(await texts(await keepPages(src, [4, 0]))).toEqual(['P5', 'P1'])
    expect(await texts(await removePages(src, [1, 3]))).toEqual(['P1', 'P3', 'P5'])
    await expect(removePages(src, [0, 1, 2, 3, 4])).rejects.toThrow(/every page/)
    const parts = await splitPdf(src, [[0, 1], [2, 3, 4]])
    expect(await Promise.all(parts.map(texts))).toEqual([['P1', 'P2'], ['P3', 'P4', 'P5']])
    const rotated = await PDFDocument.load(await rotatePages(src, new Map([[0, 90], [2, 270]])))
    expect(rotated.getPages().map((p) => p.getRotation().angle)).toEqual([90, 0, 270, 0, 0])
  })
})

describe('stamping', () => {
  it('adds page numbers with format, skipping the cover', async () => {
    const out = await addPageNumbers(await labeled('X', 3), {
      position: 'bottom-center',
      format: 'Page {n} of {total}',
      start: 1,
      fontSize: 10,
      margin: 24,
      skipFirst: true,
      color: '#000000',
    })
    expect(await texts(out)).toEqual(['X1', 'X2 Page 1 of 2', 'X3 Page 2 of 2'])
  })

  it('watermarks every page, including rotated ones', async () => {
    const d = await PDFDocument.load(await labeled('W', 2))
    d.getPage(1).setRotation(degrees(90))
    const out = await addWatermark(await d.save(), {
      text: 'CONFIDENTIAL',
      fontSize: 48,
      color: '#ff0000',
      opacity: 0.3,
      angle: 45,
      layout: 'center',
      imageScale: 0.5,
    })
    const t = await texts(out)
    expect(t.every((s) => s.includes('CONFIDENTIAL'))).toBe(true)
  })

  it('crops by display-space margins', async () => {
    const out = await cropPages(await labeled('C', 1), { top: 0.1, right: 0.2, bottom: 0.1, left: 0.2 })
    const box = (await PDFDocument.load(out)).getPage(0).getCropBox()
    expect(box.width).toBeCloseTo(612 * 0.6)
    expect(box.height).toBeCloseTo(792 * 0.8)
  })
})

/** Solid-color RGB PNG of the given size. */
function png(w: number, h: number): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b: Buffer) => {
    let c = 0xffffffff
    for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const raw = Buffer.alloc((w * 3 + 1) * h, 200)
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
}
const PNG = png(20, 10)

describe('imagesToPdf', () => {
  it('fits images on A4 with auto orientation', async () => {
    const out = await PDFDocument.load(
      await imagesToPdf([{ bytes: PNG, type: 'png' }], { pageSize: 'a4', orientation: 'auto', margin: 20 }),
    )
    const { width, height } = out.getPage(0).getSize()
    expect(width).toBeGreaterThan(height) // landscape for a wide image
  })
})
