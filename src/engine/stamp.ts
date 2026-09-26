import { StandardFonts, degrees, rgb, type PDFPage } from '@cantoo/pdf-lib'
import { loadPdf } from './load'
import { displaySize, normalizeRotation, toPdfPoint, type PageBox } from './geometry'

export function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const n = m ? parseInt(m[1], 16) : 0
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function pageBox(page: PDFPage): PageBox {
  const c = page.getCropBox()
  return {
    x0: c.x,
    y0: c.y,
    x1: c.x + c.width,
    y1: c.y + c.height,
    rotation: normalizeRotation(page.getRotation().angle),
  }
}

/**
 * Draws something in display space: (u, v) are display points (origin top-left,
 * y down) and `angle` rotates counter-clockwise as seen by the reader.
 */
export function displayDraw(page: PDFPage) {
  const box = pageBox(page)
  const size = displaySize(box)
  return {
    size,
    at(u: number, v: number) {
      return toPdfPoint(box, u / size.width, v / size.height)
    },
    rotate(angle = 0) {
      return degrees(box.rotation + angle)
    },
  }
}

export interface WatermarkOptions {
  text: string
  /** PNG/JPEG bytes instead of text. */
  image?: { bytes: Uint8Array; type: 'png' | 'jpg' }
  fontSize: number
  color: string
  opacity: number
  /** Counter-clockwise degrees as seen by the reader. */
  angle: number
  layout: 'center' | 'tile'
  /** Image width as a fraction of the page width. */
  imageScale: number
  /** Zero-based pages to stamp; all when omitted. */
  pages?: number[]
}

export async function addWatermark(input: Uint8Array, o: WatermarkOptions): Promise<Uint8Array> {
  const doc = await loadPdf(input)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const img = o.image ? (o.image.type === 'jpg' ? await doc.embedJpg(o.image.bytes) : await doc.embedPng(o.image.bytes)) : undefined
  const pages = doc.getPages()
  const targets = o.pages ?? pages.map((_, i) => i)
  const color = hexToRgb(o.color)
  const rad = (o.angle * Math.PI) / 180
  const text = o.text.replace(/[^\x20-\x7e -ÿ]/g, '?')

  for (const i of targets) {
    const page = pages[i]
    if (!page) continue
    const d = displayDraw(page)
    const { width: W, height: H } = d.size
    const itemW = img ? W * o.imageScale : font.widthOfTextAtSize(text, o.fontSize)
    const itemH = img ? (itemW * img.height) / img.width : font.heightAtSize(o.fontSize, { descender: false })

    const centers: [number, number][] = []
    if (o.layout === 'center') centers.push([W / 2, H / 2])
    else {
      const stepX = itemW * Math.abs(Math.cos(rad)) + itemH * Math.abs(Math.sin(rad)) + 60
      const stepY = itemW * Math.abs(Math.sin(rad)) + itemH * Math.abs(Math.cos(rad)) + 60
      for (let y = stepY / 2, row = 0; y < H + stepY; y += stepY, row++) {
        for (let x = (row % 2) * (stepX / 2); x < W + stepX; x += stepX) centers.push([x, y])
      }
    }

    for (const [cx, cy] of centers) {
      // Anchor = bottom-left of the item, rotated about the item's center (display space, y down).
      const ax = cx - (itemW / 2) * Math.cos(rad) - (itemH / 2) * Math.sin(rad)
      const ay = cy + (itemW / 2) * Math.sin(rad) - (itemH / 2) * Math.cos(rad)
      const p = d.at(ax, ay)
      if (img) {
        page.drawImage(img, { ...p, width: itemW, height: itemH, rotate: d.rotate(o.angle), opacity: o.opacity })
      } else {
        page.drawText(text, { ...p, size: o.fontSize, font, color, opacity: o.opacity, rotate: d.rotate(o.angle) })
      }
    }
  }
  return doc.save()
}

export type NumberPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface PageNumberOptions {
  position: NumberPosition
  /** Uses {n} and {total}, e.g. "Page {n} of {total}". */
  format: string
  start: number
  fontSize: number
  /** Distance from the page edge in points. */
  margin: number
  skipFirst: boolean
  color: string
}

export async function addPageNumbers(input: Uint8Array, o: PageNumberOptions): Promise<Uint8Array> {
  const doc = await loadPdf(input)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()
  const numbered = pages.length - (o.skipFirst ? 1 : 0)
  const color = hexToRgb(o.color)

  pages.forEach((page, i) => {
    if (o.skipFirst && i === 0) return
    const n = o.start + i - (o.skipFirst ? 1 : 0)
    const label = o.format.replaceAll('{n}', String(n)).replaceAll('{total}', String(o.start + numbered - 1))
    const d = displayDraw(page)
    const { width: W, height: H } = d.size
    const w = font.widthOfTextAtSize(label, o.fontSize)
    const [vert, horiz] = o.position.split('-')
    const u = horiz === 'left' ? o.margin : horiz === 'right' ? W - o.margin - w : (W - w) / 2
    const v = vert === 'top' ? o.margin + o.fontSize * 0.8 : H - o.margin
    page.drawText(label, { ...d.at(u, v), size: o.fontSize, font, color, rotate: d.rotate() })
  })
  return doc.save()
}

export interface CropOptions {
  /** Margins to trim, as fractions of the displayed page (0–0.45). */
  top: number
  right: number
  bottom: number
  left: number
}

/** Crops every page by setting its CropBox (content outside is hidden, not deleted). */
export async function cropPages(input: Uint8Array, o: CropOptions): Promise<Uint8Array> {
  const doc = await loadPdf(input)
  for (const page of doc.getPages()) {
    const box = pageBox(page)
    const a = toPdfPoint(box, o.left, o.top)
    const b = toPdfPoint(box, 1 - o.right, 1 - o.bottom)
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    const w = Math.abs(a.x - b.x)
    const h = Math.abs(a.y - b.y)
    page.setCropBox(x, y, w, h)
    page.setMediaBox(x, y, w, h)
  }
  return doc.save()
}
