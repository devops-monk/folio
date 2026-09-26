/** A page's visible box in PDF user space plus its /Rotate value. */
export interface PageBox {
  x0: number
  y0: number
  x1: number
  y1: number
  /** Clockwise rotation in degrees: 0, 90, 180 or 270. */
  rotation: number
}

export function normalizeRotation(deg: number): number {
  return (((Math.round(deg / 90) * 90) % 360) + 360) % 360
}

/** Size of the page as the viewer displays it, in PDF points. */
export function displaySize(box: PageBox): { width: number; height: number } {
  const w = box.x1 - box.x0
  const h = box.y1 - box.y0
  return box.rotation % 180 === 0 ? { width: w, height: h } : { width: h, height: w }
}

/**
 * Converts a point given as fractions (u → right, v → down) of the displayed
 * page into PDF user-space coordinates, accounting for page rotation.
 */
export function toPdfPoint(box: PageBox, u: number, v: number): { x: number; y: number } {
  const W = box.x1 - box.x0
  const H = box.y1 - box.y0
  switch (box.rotation) {
    case 90:
      return { x: box.x0 + v * W, y: box.y0 + u * H }
    case 180:
      return { x: box.x1 - u * W, y: box.y0 + v * H }
    case 270:
      return { x: box.x1 - v * W, y: box.y1 - u * H }
    default:
      return { x: box.x0 + u * W, y: box.y1 - v * H }
  }
}
