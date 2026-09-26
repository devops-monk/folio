/** Canvas helpers that turn drawn, typed or uploaded signatures into trimmed transparent PNGs. */

export interface SignatureImage {
  src: string
  width: number
  height: number
}

/** Crops a canvas to its non-transparent pixels (plus padding) and returns a PNG. */
export function trimToPng(canvas: HTMLCanvasElement, pad = 6): SignatureImage | null {
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas
  const data = ctx.getImageData(0, 0, width, height).data
  let top = height
  let left = width
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (right < 0) return null

  left = Math.max(0, left - pad)
  top = Math.max(0, top - pad)
  const w = Math.min(width, right + pad + 1) - left
  const h = Math.min(height, bottom + pad + 1) - top
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(canvas, left, top, w, h, 0, 0, w, h)
  return { src: out.toDataURL('image/png'), width: w, height: h }
}

/** Renders typed text in a script font as a signature image. */
export async function typedSignature(text: string, family: string, color: string): Promise<SignatureImage | null> {
  const size = 120
  const font = `${size}px "${family}"`
  await document.fonts.load(font, text)
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = font
  const m = measure.measureText(text)
  // Script fonts overhang their advance width, so leave generous room and trim afterwards.
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(m.width + size * 1.5)
  canvas.height = Math.ceil(size * 2.2)
  const ctx = canvas.getContext('2d')!
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, size * 0.6, size * 1.45)
  return trimToPng(canvas)
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

/**
 * Loads a photo or scan of a signature. With `removeBackground`, light paper
 * pixels become transparent and ink keeps a soft anti-aliased edge.
 */
export async function uploadedSignature(file: File, removeBackground: boolean): Promise<SignatureImage | null> {
  const img = await loadImage(file)
  const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * k))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  if (removeBackground) {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = image.data
    // Estimate the paper brightness from the brightest pixels, so shadows and
    // off-white paper still clear out.
    const lum = new Uint8Array(d.length / 4)
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      lum[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    }
    const sorted = Uint8Array.from(lum).sort()
    const paper = sorted[Math.floor(sorted.length * 0.9)]
    const hi = paper - 18 // at or above: fully transparent
    const lo = paper - 110 // at or below: fully opaque ink
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const l = lum[j]
      const alpha = l >= hi ? 0 : l <= lo ? 1 : (hi - l) / (hi - lo)
      d[i + 3] = Math.round(d[i + 3] * alpha)
    }
    ctx.putImageData(image, 0, 0)
    return trimToPng(canvas)
  }
  return { src: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
}
