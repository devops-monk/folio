import { PDFDocument, degrees } from '@cantoo/pdf-lib'
import { loadPdf } from './load'
import { normalizeRotation } from './geometry'

/** One page in an assembled output: which source file, which page, and extra rotation. */
export interface PageRef {
  file: number
  /** Zero-based page index in that file. */
  page: number
  /** Extra clockwise rotation to apply, in degrees (multiples of 90). */
  rotate?: number
}

/**
 * Builds a new PDF from pages of one or more source PDFs, in the given order.
 * This is the single primitive behind merge, extract, remove, reorder and rotate.
 */
export async function assemble(sources: Uint8Array[], refs: PageRef[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const docs = await Promise.all(sources.map((s) => loadPdf(s)))
  // Copy per source in one call each (shares fonts/images), then place in order.
  const copied = new Map<string, Awaited<ReturnType<PDFDocument['copyPages']>>[number]>()
  for (let f = 0; f < docs.length; f++) {
    const wanted = [...new Set(refs.filter((r) => r.file === f).map((r) => r.page))]
    if (!wanted.length) continue
    const pages = await out.copyPages(docs[f], wanted)
    wanted.forEach((p, i) => copied.set(`${f}:${p}`, pages[i]))
  }
  const used = new Set<string>()
  for (const r of refs) {
    const key = `${r.file}:${r.page}`
    let page = copied.get(key)
    if (!page) throw new Error(`Page ${r.page + 1} of file ${r.file + 1} doesn’t exist.`)
    // The same page placed twice needs its own copy.
    if (used.has(key)) [page] = await out.copyPages(docs[r.file], [r.page])
    used.add(key)
    if (r.rotate) page.setRotation(degrees(normalizeRotation(page.getRotation().angle + r.rotate)))
    out.addPage(page)
  }
  return out.save()
}

export async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await loadPdf(bytes)).getPageCount()
}

export async function mergePdfs(sources: Uint8Array[]): Promise<Uint8Array> {
  const refs: PageRef[] = []
  for (let f = 0; f < sources.length; f++) {
    const n = await pageCount(sources[f])
    for (let p = 0; p < n; p++) refs.push({ file: f, page: p })
  }
  return assemble(sources, refs)
}

/** Keeps only the given pages (zero-based), in the given order. */
export function keepPages(bytes: Uint8Array, pages: number[]) {
  return assemble([bytes], pages.map((page) => ({ file: 0, page })))
}

/** Removes the given pages (zero-based). */
export async function removePages(bytes: Uint8Array, remove: number[]) {
  const n = await pageCount(bytes)
  const drop = new Set(remove)
  const keep = Array.from({ length: n }, (_, i) => i).filter((i) => !drop.has(i))
  if (!keep.length) throw new Error('You can’t remove every page.')
  return keepPages(bytes, keep)
}

/** Rotates pages by `angle` (clockwise); all pages when `pages` is omitted. */
export async function rotatePages(bytes: Uint8Array, rotations: Map<number, number>) {
  const n = await pageCount(bytes)
  return assemble(
    [bytes],
    Array.from({ length: n }, (_, page) => ({ file: 0, page, rotate: rotations.get(page) ?? 0 })),
  )
}

/** Splits into one file per group of zero-based page indices. */
export function splitPdf(bytes: Uint8Array, groups: number[][]): Promise<Uint8Array[]> {
  return Promise.all(groups.map((g) => keepPages(bytes, g)))
}

/**
 * Parses page ranges like "1-3, 5, 8-" (1-based, inclusive) into groups of
 * zero-based indices. "8-" means to the end; "-3" means from the start.
 * Throws with a user-facing message on invalid input.
 */
export function parseRanges(input: string, total: number): number[][] {
  const parts = input
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!parts.length) throw new Error('Enter at least one page or range, like 1-3, 5.')
  return parts.map((part) => {
    const m = /^(\d*)\s*[-–]\s*(\d*)$/.exec(part) ?? /^(\d+)$/.exec(part)
    if (!m) throw new Error(`“${part}” isn’t a page or range.`)
    const single = m.length === 2
    const from = single ? Number(m[1]) : m[1] ? Number(m[1]) : 1
    const to = single ? from : m[2] ? Number(m[2]) : total
    if (from < 1 || to < 1 || from > total || to > total) {
      throw new Error(`“${part}” is outside 1–${total}.`)
    }
    if (from > to) throw new Error(`“${part}” goes backwards.`)
    return Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i)
  })
}

/** Groups of `size` consecutive pages. */
export function chunkPages(total: number, size: number): number[][] {
  const groups: number[][] = []
  for (let i = 0; i < total; i += size) {
    groups.push(Array.from({ length: Math.min(size, total - i) }, (_, k) => i + k))
  }
  return groups
}

/** Human description of page groups, e.g. "1–3", "5". */
export function describeGroup(g: number[]): string {
  if (!g.length) return ''
  const first = g[0] + 1
  const last = g[g.length - 1] + 1
  return first === last ? `${first}` : `${first}–${last}`
}
