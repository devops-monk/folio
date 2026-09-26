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

describe('exportDocument with forms', () => {
  it('fills text, checkbox, radio and dropdown fields, and can flatten', async () => {
    const { exportDocument } = await import('./export')
    const src = await PDFDocument.create()
    const page = src.addPage([612, 792])
    const form = src.getForm()
    form.createTextField('name').addToPage(page, { x: 50, y: 700, width: 200, height: 20 })
    form.createCheckBox('agree').addToPage(page, { x: 50, y: 660, width: 14, height: 14 })
    const radio = form.createRadioGroup('plan')
    radio.addOptionToPage('basic', page, { x: 50, y: 620, width: 14, height: 14 })
    radio.addOptionToPage('pro', page, { x: 90, y: 620, width: 14, height: 14 })
    const dd = form.createDropdown('country')
    dd.addOptions(['India', 'UK'])
    dd.addToPage(page, { x: 50, y: 580, width: 100, height: 20 })
    const input = await src.save()

    const values = { name: 'Abhay Singh', agree: true, plan: 'pro', country: 'UK' }
    const filled = await PDFDocument.load(await exportDocument(input, { overlays: [], formValues: values, flattenForm: false }))
    const f = filled.getForm()
    expect(f.getTextField('name').getText()).toBe('Abhay Singh')
    expect(f.getCheckBox('agree').isChecked()).toBe(true)
    expect(f.getRadioGroup('plan').getSelected()).toBe('pro')
    expect(f.getDropdown('country').getSelected()).toEqual(['UK'])

    const flat = await PDFDocument.load(await exportDocument(input, { overlays: [], formValues: values, flattenForm: true }))
    expect(flat.getForm().getFields()).toHaveLength(0)
  })
})
