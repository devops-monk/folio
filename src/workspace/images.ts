const MAX_SIDE = 2000

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function decode(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Prepares an image for embedding: returns a PNG or JPEG data URL (the only
 * formats PDFs embed directly), downscaled so huge photos don't bloat the file.
 */
export async function loadImageForPdf(file: File): Promise<{ src: string; width: number; height: number }> {
  const original = await readAsDataUrl(file)
  const img = await decode(original)
  const { naturalWidth: w, naturalHeight: h } = img
  const isJpeg = /image\/jpe?g/.test(file.type)
  const isPng = file.type === 'image/png'

  if ((isJpeg || isPng) && Math.max(w, h) <= MAX_SIDE) return { src: original, width: w, height: h }

  const k = Math.min(1, MAX_SIDE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * k)
  canvas.height = Math.round(h * k)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  const src = isJpeg ? canvas.toDataURL('image/jpeg', 0.9) : canvas.toDataURL('image/png')
  return { src, width: canvas.width, height: canvas.height }
}
