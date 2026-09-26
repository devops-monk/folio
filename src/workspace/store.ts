import { create } from 'zustand'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import type { Overlay } from '../engine/overlays'
import { describeOpenError, openPdf } from './pdf'

export interface PageInfo {
  /** Displayed (rotation-applied) size in PDF points. */
  width: number
  height: number
}

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const HISTORY_LIMIT = 100

interface WorkspaceState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  fileName: string
  bytes: Uint8Array | null
  pdf: PDFDocumentProxy | null
  pages: PageInfo[]

  overlays: Overlay[]
  past: Overlay[][]
  future: Overlay[][]
  selectedId: string | null
  editingId: string | null

  currentPage: number
  /** CSS pixels per PDF point. */
  scale: number
  /** True until the user zooms manually; the view then stops auto-fitting. */
  fit: boolean

  open: (file: File) => Promise<void>
  reset: () => void

  /** Saves the current overlays so the next change can be undone. */
  checkpoint: () => void
  /** Discards the last checkpoint (a gesture that changed nothing). */
  dropCheckpoint: () => void
  undo: () => void
  redo: () => void

  add: (o: Overlay) => void
  /** Adds an overlay without recording history. */
  insert: (o: Overlay) => void
  /** Changes an overlay without recording history (use inside gestures). */
  patch: (id: string, changes: Partial<Overlay>) => void
  /** Changes an overlay as one undoable step. */
  update: (id: string, changes: Partial<Overlay>) => void
  remove: (id: string) => void
  /** Removes an overlay without recording history. */
  discard: (id: string) => void
  select: (id: string | null) => void
  setEditing: (id: string | null) => void

  setCurrentPage: (i: number) => void
  setFitScale: (scale: number) => void
  zoom: (factor: number) => void
  zoomToFit: () => void
}

const empty = {
  status: 'idle' as const,
  error: null,
  fileName: '',
  bytes: null,
  pdf: null,
  pages: [],
  overlays: [],
  past: [],
  future: [],
  selectedId: null,
  editingId: null,
  currentPage: 0,
  scale: 1,
  fit: true,
}

// The open document's loading task (owns the worker-side resources), and a
// counter so a slow load that was superseded or cancelled can't win the race.
let task: PDFDocumentLoadingTask | null = null
let generation = 0

function releaseDocument() {
  generation++
  task?.destroy()
  task = null
}

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  ...empty,

  open: async (file) => {
    releaseDocument()
    const mine = generation
    set({ ...empty, status: 'loading', fileName: file.name })
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const t = await openPdf(bytes)
      if (mine !== generation) return void t.destroy()
      task = t
      const pdf = await t.promise
      const pages: PageInfo[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const vp = (await pdf.getPage(i)).getViewport({ scale: 1 })
        pages.push({ width: vp.width, height: vp.height })
      }
      if (mine !== generation) return
      set({ status: 'ready', bytes, pdf, pages })
    } catch (err) {
      if (mine !== generation) return
      console.error(err)
      set({ status: 'error', error: describeOpenError(err) })
    }
  },

  reset: () => {
    releaseDocument()
    set(empty)
  },

  checkpoint: () =>
    set((s) => ({ past: [...s.past, s.overlays].slice(-HISTORY_LIMIT), future: [] })),
  dropCheckpoint: () => set((s) => ({ past: s.past.slice(0, -1) })),

  undo: () =>
    set((s) => {
      if (!s.past.length) return s
      return {
        overlays: s.past[s.past.length - 1],
        past: s.past.slice(0, -1),
        future: [s.overlays, ...s.future],
        editingId: null,
      }
    }),
  redo: () =>
    set((s) => {
      if (!s.future.length) return s
      return {
        overlays: s.future[0],
        past: [...s.past, s.overlays],
        future: s.future.slice(1),
        editingId: null,
      }
    }),

  add: (o) => {
    get().checkpoint()
    get().insert(o)
  },
  insert: (o) => set((s) => ({ overlays: [...s.overlays, o], selectedId: o.id })),
  patch: (id, changes) =>
    set((s) => ({
      overlays: s.overlays.map((o) => (o.id === id ? ({ ...o, ...changes } as Overlay) : o)),
    })),
  update: (id, changes) => {
    get().checkpoint()
    get().patch(id, changes)
  },
  remove: (id) => {
    get().checkpoint()
    get().discard(id)
  },
  discard: (id) =>
    set((s) => ({
      overlays: s.overlays.filter((o) => o.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      editingId: s.editingId === id ? null : s.editingId,
    })),
  select: (id) =>
    set((s) => ({ selectedId: id, editingId: s.editingId === id ? s.editingId : null })),
  setEditing: (id) => set({ editingId: id, ...(id ? { selectedId: id } : {}) }),

  setCurrentPage: (i) => set({ currentPage: i }),
  setFitScale: (scale) => {
    if (get().fit) set({ scale: clampScale(scale) })
  },
  zoom: (factor) => set((s) => ({ scale: clampScale(s.scale * factor), fit: false })),
  zoomToFit: () => set({ fit: true }),
}))
