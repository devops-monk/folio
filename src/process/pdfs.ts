import { useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { openPdf } from '../workspace/pdf'

export interface PageItem {
  key: string
  file: number
  page: number
  /** Extra clockwise rotation in degrees. */
  rotate: number
}

export interface LoadedPdfs {
  status: 'loading' | 'ready' | 'error'
  error?: string
  docs: PDFDocumentProxy[]
  bytes: Uint8Array[]
  /** Display size (points) of each page per file. */
  sizes: { w: number; h: number }[][]
}

const LOADING: LoadedPdfs = { status: 'loading', docs: [], bytes: [], sizes: [] }

/** Opens PDFs with pdf.js for thumbnails; cleans up on change/unmount. */
export function useLoadedPdfs(files: File[]): LoadedPdfs {
  // Results are tagged with the files they belong to, so a new file set reads as loading.
  const [state, setState] = useState<{ files: File[]; value: LoadedPdfs } | null>(null)
  useEffect(() => {
    let live = true
    const tasks: { destroy: () => void }[] = []
    ;(async () => {
      try {
        const bytes = await Promise.all(files.map(async (f) => new Uint8Array(await f.arrayBuffer())))
        const docs: PDFDocumentProxy[] = []
        const sizes: { w: number; h: number }[][] = []
        for (const b of bytes) {
          const t = await openPdf(b)
          tasks.push(t)
          const doc = await t.promise
          docs.push(doc)
          const s = []
          for (let i = 1; i <= doc.numPages; i++) {
            const vp = (await doc.getPage(i)).getViewport({ scale: 1 })
            s.push({ w: vp.width, h: vp.height })
          }
          sizes.push(s)
        }
        if (live) setState({ files, value: { status: 'ready', docs, bytes, sizes } })
      } catch (err) {
        const name = (err as { name?: string })?.name
        const error = name === 'PasswordException' ? 'This PDF is password-protected. Unlock it first.' : 'We couldn’t read this PDF.'
        if (live) setState({ files, value: { ...LOADING, status: 'error', error } })
      }
    })()
    return () => {
      live = false
      tasks.forEach((t) => t.destroy())
    }
  }, [files])
  return state?.files === files ? state.value : LOADING
}

export function initialItems(sizes: { w: number; h: number }[][]): PageItem[] {
  return sizes.flatMap((pages, file) => pages.map((_, page) => ({ key: `${file}:${page}:${crypto.randomUUID()}`, file, page, rotate: 0 })))
}

const keys = new WeakMap<LoadedPdfs, string>()
/** A React key that changes whenever a new set of documents finishes loading. */
export function pdfsKey(pdfs: LoadedPdfs): string {
  let k = keys.get(pdfs)
  if (!k) {
    k = crypto.randomUUID()
    keys.set(pdfs, k)
  }
  return k
}
