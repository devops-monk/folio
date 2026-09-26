import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage } from '@cantoo/pdf-lib'
import { displaySize, normalizeRotation, toPdfPoint, type PageBox } from './geometry'
import { TEXT_BASELINE, TEXT_LINE_HEIGHT, type Overlay } from './overlays'

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const n = m ? parseInt(m[1], 16) : 0
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function dataUrlBytes(src: string): { bytes: Uint8Array; type: 'png' | 'jpg' } {
  const [head, body] = src.split(',', 2)
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { bytes, type: /image\/jpe?g/i.test(head) ? 'jpg' : 'png' }
}

/** Replaces characters Helvetica (WinAnsi) can't encode so export never throws. */
function encodable(font: PDFFont, text: string) {
  let out = ''
  for (const ch of text) {
    try {
      font.encodeText(ch)
      out += ch
    } catch {
      out += '?'
    }
  }
  return out
}

/**
 * Burns overlays into the PDF and returns the new file. Pure: the input bytes
 * are not modified.
 */
export async function flattenOverlays(input: Uint8Array, overlays: Overlay[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.slice(), { ignoreEncryption: true })
  const pages = doc.getPages()
  let font: PDFFont | undefined
  const images = new Map<string, PDFImage>()

  for (const o of overlays) {
    const page = pages[o.page]
    if (!page) continue
    const crop = page.getCropBox()
    const box: PageBox = {
      x0: crop.x,
      y0: crop.y,
      x1: crop.x + crop.width,
      y1: crop.y + crop.height,
      rotation: normalizeRotation(page.getRotation().angle),
    }
    const size = displaySize(box)
    // Content is drawn counter-rotated so it appears upright in viewers.
    const rotate = degrees(box.rotation)
    const bottomLeft = toPdfPoint(box, o.x, o.y + o.h)
    const width = o.w * size.width
    const height = o.h * size.height

    if (o.kind === 'rect') {
      page.drawRectangle({
        ...bottomLeft,
        width,
        height,
        rotate,
        color: hexToRgb(o.fill),
        opacity: o.opacity,
        borderWidth: 0,
      })
    } else if (o.kind === 'image') {
      let img = images.get(o.src)
      if (!img) {
        const { bytes, type } = dataUrlBytes(o.src)
        img = type === 'jpg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)
        images.set(o.src, img)
      }
      page.drawImage(img, { ...bottomLeft, width, height, rotate })
    } else {
      font ??= await doc.embedFont(StandardFonts.Helvetica)
      const color = hexToRgb(o.color)
      o.text.split('\n').forEach((line, i) => {
        if (!line) return
        const baselineV = o.y + ((i * TEXT_LINE_HEIGHT + TEXT_BASELINE) * o.fontSize) / size.height
        page.drawText(encodable(font!, line), {
          ...toPdfPoint(box, o.x, baselineV),
          size: o.fontSize,
          font,
          color,
          rotate,
        })
      })
    }
  }

  return doc.save()
}
