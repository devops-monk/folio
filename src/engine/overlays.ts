/**
 * Editable objects placed on top of PDF pages. Positions and sizes are
 * fractions (0–1) of the page as displayed (i.e. after /Rotate is applied),
 * so they are independent of zoom level and device pixel ratio.
 * They only become PDF content when flattened on download.
 */

interface OverlayBase {
  id: string
  /** Zero-based page index. */
  page: number
  /** Top-left corner, as a fraction of displayed page width/height. */
  x: number
  y: number
  /** Size as a fraction of displayed page width/height. */
  w: number
  h: number
}

export interface TextOverlay extends OverlayBase {
  kind: 'text'
  text: string
  /** Font size in PDF points. */
  fontSize: number
  /** Hex color, e.g. #1d1d1f */
  color: string
}

export interface ImageOverlay extends OverlayBase {
  kind: 'image'
  /** PNG or JPEG data URL. */
  src: string
}

export interface RectOverlay extends OverlayBase {
  kind: 'rect'
  fill: string
  opacity: number
}

export type Overlay = TextOverlay | ImageOverlay | RectOverlay

/** Line height used by both the on-screen text box and the PDF export. */
export const TEXT_LINE_HEIGHT = 1.2
/**
 * Distance from the top of a line box to the baseline, in ems, for
 * Arial/Helvetica metrics with CSS line-height 1.2. Keeps exported text
 * where it appeared on screen.
 */
export const TEXT_BASELINE = 0.9465
/** CSS font stack whose metrics match the PDF's Helvetica. */
export const TEXT_FONT_STACK = 'Arial, Helvetica, "Liberation Sans", Arimo, sans-serif'
