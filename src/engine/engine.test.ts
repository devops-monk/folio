import { describe, expect, it } from 'vitest'
import { PDFDocument, degrees } from '@cantoo/pdf-lib'
import { displaySize, toPdfPoint, type PageBox } from './geometry'
import { flattenOverlays } from './flatten'
import type { Overlay } from './overlays'

const letter: Omit<PageBox, 'rotation'> = { x0: 0, y0: 0, x1: 612, y1: 792 }

describe('toPdfPoint', () => {
  it('maps display corners for every rotation', () => {
    // The displayed top-left corner must land on the right PDF corner.
    expect(toPdfPoint({ ...letter, rotation: 0 }, 0, 0)).toEqual({ x: 0, y: 792 })
    expect(toPdfPoint({ ...letter, rotation: 90 }, 0, 0)).toEqual({ x: 0, y: 0 })
    expect(toPdfPoint({ ...letter, rotation: 180 }, 0, 0)).toEqual({ x: 612, y: 0 })
    expect(toPdfPoint({ ...letter, rotation: 270 }, 0, 0)).toEqual({ x: 612, y: 792 })
    // Displayed bottom-right is the opposite corner.
    expect(toPdfPoint({ ...letter, rotation: 0 }, 1, 1)).toEqual({ x: 612, y: 0 })
    expect(toPdfPoint({ ...letter, rotation: 90 }, 1, 1)).toEqual({ x: 612, y: 792 })
    expect(toPdfPoint({ ...letter, rotation: 180 }, 1, 1)).toEqual({ x: 0, y: 792 })
    expect(toPdfPoint({ ...letter, rotation: 270 }, 1, 1)).toEqual({ x: 0, y: 0 })
  })

  it('respects a crop box offset', () => {
    const box: PageBox = { x0: 50, y0: 100, x1: 550, y1: 700, rotation: 0 }
    expect(toPdfPoint(box, 0.5, 0.5)).toEqual({ x: 300, y: 400 })
  })

  it('swaps display size for quarter turns', () => {
    expect(displaySize({ ...letter, rotation: 90 })).toEqual({ width: 792, height: 612 })
    expect(displaySize({ ...letter, rotation: 180 })).toEqual({ width: 612, height: 792 })
  })
})

// 1×1 red PNG
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='

describe('flattenOverlays', () => {
  it('writes text, images and rects onto normal and rotated pages', async () => {
    const src = await PDFDocument.create()
    src.addPage([612, 792])
    src.addPage([612, 792]).setRotation(degrees(90))
    const input = await src.save()
    const before = input.slice()

    const base = { x: 0.1, y: 0.1, w: 0.3, h: 0.1 }
    const overlays: Overlay[] = [
      { id: 'a', page: 0, kind: 'text', text: 'Hello\nWorld ✓', fontSize: 14, color: '#112233', ...base },
      { id: 'b', page: 1, kind: 'image', src: PNG, ...base },
      { id: 'c', page: 1, kind: 'rect', fill: '#ffffff', opacity: 1, ...base },
      { id: 'd', page: 5, kind: 'rect', fill: '#000000', opacity: 1, ...base }, // out of range: ignored
    ]
    const out = await flattenOverlays(input, overlays)

    expect(input).toEqual(before) // input untouched
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getPage(1).getRotation().angle).toBe(90)
    expect(out.byteLength).toBeGreaterThan(input.byteLength)
  })
})
