import { PDFDocument } from '@cantoo/pdf-lib'

export interface ImageInput {
  bytes: Uint8Array
  type: 'png' | 'jpg'
}

export interface ImagesToPdfOptions {
  pageSize: 'fit' | 'a4' | 'letter'
  orientation: 'auto' | 'portrait' | 'landscape'
  /** Margin in points (ignored for "fit"). */
  margin: number
}

const SIZES: Record<'a4' | 'letter', [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] }

/** One image per page, scaled to fit and centered. */
export async function imagesToPdf(images: ImageInput[], o: ImagesToPdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (const im of images) {
    const img = im.type === 'jpg' ? await doc.embedJpg(im.bytes) : await doc.embedPng(im.bytes)
    if (o.pageSize === 'fit') {
      // 1 image pixel = 0.75pt (96 dpi), a natural size for photos and screenshots.
      const w = img.width * 0.75
      const h = img.height * 0.75
      doc.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h })
      continue
    }
    let [pw, ph] = SIZES[o.pageSize]
    const landscape = o.orientation === 'landscape' || (o.orientation === 'auto' && img.width > img.height)
    if (landscape) [pw, ph] = [ph, pw]
    const page = doc.addPage([pw, ph])
    const maxW = pw - 2 * o.margin
    const maxH = ph - 2 * o.margin
    const k = Math.min(maxW / img.width, maxH / img.height)
    const w = img.width * k
    const h = img.height * k
    page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
  }
  return doc.save()
}
