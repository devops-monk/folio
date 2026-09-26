import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Download,
  Highlighter,
  ImagePlus,
  LoaderCircle,
  Minus,
  Plus,
  Redo2,
  Signature,
  Square,
  Type,
  Undo2,
  X,
} from 'lucide-react'
import type { ToolDef } from '../tools/registry'
import type { Overlay } from '../engine/overlays'
import type { PageSpot } from './store'
import { useWorkspace } from './store'
import { PageCanvas } from './PageCanvas'
import { OverlayItem } from './OverlayItem'
import { Inspector } from './Inspector'
import { FormLayer } from './FormLayer'
import { loadImageForPdf } from './images'
import { SignatureSheet } from './signature/SignatureSheet'
import type { SignatureImage } from './signature/render'
import './Workspace.css'

interface Props {
  file: File
  tool: ToolDef
  onClose: () => void
}

export default function Workspace({ file, tool, onClose }: Props) {
  const status = useWorkspace((s) => s.status)
  const error = useWorkspace((s) => s.error)

  useEffect(() => {
    useWorkspace.getState().open(file)
    return () => useWorkspace.getState().reset()
  }, [file])

  // Warn before losing unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const s = useWorkspace.getState()
      if (s.overlays.length || Object.keys(s.changedFields).length) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const close = () => {
    const s = useWorkspace.getState()
    const dirty = s.overlays.length > 0 || Object.keys(s.changedFields).length > 0
    if (!dirty || window.confirm('Discard your changes to this PDF?')) onClose()
  }

  return (
    <div className="workspace" role="application" aria-label={`${tool.name} workspace`}>
      <Toolbar onClose={close} autoSign={tool.id === 'sign-pdf'} />
      {status === 'ready' ? (
        <div className="ws-body">
          <Thumbnails />
          <Pages />
          <Inspector formTool={tool.id === 'fill-form'} />
        </div>
      ) : (
        <div className="ws-state">
          {status === 'error' ? (
            <>
              <p className="ws-error">{error}</p>
              <button className="button-secondary" onClick={onClose}>
                Choose another file
              </button>
            </>
          ) : (
            <LoaderCircle className="spin" size={28} aria-label="Opening PDF" />
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Toolbar ───────────────────────────────────────────────────── */

function Toolbar({ onClose, autoSign }: { onClose: () => void; autoSign: boolean }) {
  const ws = useWorkspace()
  const imageInput = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const signing = ws.signRequest !== null
  const ready = ws.status === 'ready'

  // The Sign PDF tool opens the signature sheet as soon as the document is ready.
  const autoOpened = useRef(false)
  useEffect(() => {
    if (autoSign && ready && !autoOpened.current) {
      autoOpened.current = true
      // Documents with signature fields let the user pick the field instead.
      const s = useWorkspace.getState()
      if (!s.fields.some((f) => f.type === 'signature')) s.requestSignature()
    }
  }, [autoSign, ready])

  const insertSignature = (sig: SignatureImage) => {
    const target: PageSpot | undefined = ws.signRequest?.target
    ws.closeSignature()
    const page = ws.pages[target?.page ?? ws.currentPage]
    const aspect = (sig.height / sig.width) * (page.width / page.height) // h/w in page fractions
    if (target) {
      // Fit inside the signature field, centered.
      let w = target.w
      let h = w * aspect
      if (h > target.h) {
        h = target.h
        w = h / aspect
      }
      ws.add({
        id: crypto.randomUUID(),
        kind: 'image',
        src: sig.src,
        page: target.page,
        x: target.x + (target.w - w) / 2,
        y: target.y + (target.h - h) / 2,
        w,
        h,
      })
      return
    }
    const w = 0.28
    ws.add({ id: crypto.randomUUID(), kind: 'image', src: sig.src, ...placeOnCurrentPage(w, Math.min(w * aspect, 0.3)) })
  }

  // New objects appear centered near the top third; if that spot is taken,
  // cascade downward so they don't stack exactly on top of each other.
  const placeOnCurrentPage = (w: number, h: number) => {
    const x = (1 - w) / 2
    let y = Math.max(0, (1 - h) / 2 - 0.1)
    const taken = (yy: number) =>
      ws.overlays.some((o) => o.page === ws.currentPage && Math.abs(o.y - yy) < 0.02 && Math.abs(o.x + o.w / 2 - 0.5) < 0.05)
    while (taken(y) && y + h + 0.05 < 1) y += 0.05
    return { page: ws.currentPage, x, y, w, h }
  }

  const addText = () => {
    const o: Overlay = {
      id: crypto.randomUUID(),
      kind: 'text',
      text: '',
      fontSize: 16,
      color: '#1d1d1f',
      ...placeOnCurrentPage(0.2, 0.03),
    }
    // One undo step covers creating and typing; see OverlayItem.finishEditing.
    ws.checkpoint()
    ws.insert(o)
    ws.setEditing(o.id)
  }

  const addRect = (fill: string, opacity: number) => {
    const page = ws.pages[ws.currentPage]
    const h = (0.04 * page.width) / page.height
    ws.add({ id: crypto.randomUUID(), kind: 'rect', fill, opacity, ...placeOnCurrentPage(0.3, h) })
  }

  const addImage = async (f: File) => {
    try {
      const img = await loadImageForPdf(f)
      const page = ws.pages[ws.currentPage]
      const w = 0.35
      const h = (w * page.width * (img.height / img.width)) / page.height
      ws.add({ id: crypto.randomUUID(), kind: 'image', src: img.src, ...placeOnCurrentPage(w, Math.min(h, 0.9)) })
    } catch {
      flash('That image couldn’t be read.')
    }
  }

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2400)
  }

  const download = async () => {
    const { bytes, overlays, fileName, formValues, changedFields, flattenForm } = useWorkspace.getState()
    if (!bytes || saving) return
    setSaving(true)
    try {
      // pdf-lib is only needed at save time, so it loads on first download.
      const { exportDocument } = await import('../engine/export')
      const changed = Object.fromEntries(Object.keys(changedFields).map((k) => [k, formValues[k]]))
      const out = await exportDocument(bytes, { overlays, formValues: changed, flattenForm })
      const url = URL.createObjectURL(new Blob([out as BlobPart], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = fileName.replace(/\.pdf$/i, '') + (Object.keys(changed).length ? '-filled.pdf' : '-edited.pdf')
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      flash('Downloaded')
    } catch (err) {
      console.error(err)
      flash('Something went wrong while saving.')
    } finally {
      setSaving(false)
    }
  }

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useWorkspace.getState()
      if (s.status !== 'ready' || signing) return
      const inField = (e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (mod && key === 's') {
        e.preventDefault()
        download()
        return
      }
      if (inField) return

      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if (mod && key === 'y') {
        e.preventDefault()
        s.redo()
      } else if (mod && (key === '=' || key === '+')) {
        e.preventDefault()
        s.zoom(1.25)
      } else if (mod && key === '-') {
        e.preventDefault()
        s.zoom(0.8)
      } else if (mod && key === '0') {
        e.preventDefault()
        s.zoomToFit()
      } else if (s.selectedId && (key === 'backspace' || key === 'delete')) {
        e.preventDefault()
        s.remove(s.selectedId)
      } else if (key === 'escape') {
        s.select(null)
      } else if (s.selectedId && key.startsWith('arrow')) {
        e.preventDefault()
        const o = s.overlays.find((x) => x.id === s.selectedId)
        const page = o && s.pages[o.page]
        if (!o || !page) return
        const step = e.shiftKey ? 10 : 1
        const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0
        const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0
        s.update(o.id, { x: o.x + dx / page.width, y: o.y + dy / page.height })
      } else if (key === 't' && !mod) {
        e.preventDefault()
        addText()
      } else if (key === 's' && !mod) {
        e.preventDefault()
        s.requestSignature()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <header className="ws-toolbar">
      <div className="ws-toolbar-group">
        <button className="tb-button" onClick={onClose} aria-label="Close" title="Close">
          <X size={19} />
        </button>
        <div className="ws-title">
          <span className="ws-filename">{ws.fileName}</span>
          {ready && (
            <span className="ws-meta">
              {ws.pages.length} {ws.pages.length === 1 ? 'page' : 'pages'}
            </span>
          )}
        </div>
      </div>

      <div className="ws-toolbar-group ws-tools" aria-label="Insert">
        <button
          className="tb-button labeled"
          onClick={() => ws.requestSignature()}
          disabled={!ready}
          aria-label="Sign"
          title="Add signature (S)"
        >
          <Signature size={18} />
          <span>Sign</span>
        </button>
        <button className="tb-button labeled" onClick={addText} disabled={!ready} aria-label="Text" title="Add text (T)">
          <Type size={18} />
          <span>Text</span>
        </button>
        <button
          className="tb-button labeled"
          onClick={() => imageInput.current?.click()}
          disabled={!ready}
          aria-label="Image" title="Add image"
        >
          <ImagePlus size={18} />
          <span>Image</span>
        </button>
        <button className="tb-button labeled" onClick={() => addRect('#ffffff', 1)} disabled={!ready} aria-label="Whiteout" title="Cover content with a white box">
          <Square size={18} />
          <span>Whiteout</span>
        </button>
        <button className="tb-button labeled" onClick={() => addRect('#ffd60a', 0.4)} disabled={!ready} aria-label="Highlight" title="Highlight an area">
          <Highlighter size={18} />
          <span>Highlight</span>
        </button>
        <input
          ref={imageInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="visually-hidden"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) addImage(f)
            e.target.value = ''
          }}
        />
      </div>

      <div className="ws-toolbar-group">
        <button className="tb-button" onClick={ws.undo} disabled={!ws.past.length} aria-label="Undo" title="Undo (⌘Z)">
          <Undo2 size={18} />
        </button>
        <button className="tb-button" onClick={ws.redo} disabled={!ws.future.length} aria-label="Redo" title="Redo (⇧⌘Z)">
          <Redo2 size={18} />
        </button>
        <div className="ws-zoom">
          <button className="tb-button" onClick={() => ws.zoom(0.8)} disabled={!ready} aria-label="Zoom out">
            <Minus size={16} />
          </button>
          <button className="ws-zoom-value" onClick={ws.zoomToFit} disabled={!ready} title="Fit to width (⌘0)">
            {Math.round(ws.scale * 100)}%
          </button>
          <button className="tb-button" onClick={() => ws.zoom(1.25)} disabled={!ready} aria-label="Zoom in">
            <Plus size={16} />
          </button>
        </div>
        <button className="ws-download" onClick={download} disabled={!ready || saving} aria-label="Download" title="Download (⌘S)">
          {saving ? <LoaderCircle className="spin" size={17} /> : <Download size={17} strokeWidth={2.4} />}
          <span>Download</span>
        </button>
      </div>

      {/* Portaled: the toolbar's backdrop-filter would otherwise trap position: fixed. */}
      {signing &&
        createPortal(
          <SignatureSheet onInsert={insertSignature} onClose={ws.closeSignature} />,
          document.body,
        )}
      {toast &&
        createPortal(
          <div className="ws-toast" role="status">
            {toast}
          </div>,
          document.body,
        )}
    </header>
  )
}

/* ─── Thumbnails ────────────────────────────────────────────────── */

const THUMB_WIDTH = 116

function Thumbnails() {
  const pdf = useWorkspace((s) => s.pdf)!
  const pages = useWorkspace((s) => s.pages)
  const current = useWorkspace((s) => s.currentPage)
  const listRef = useRef<HTMLOListElement>(null)

  // Keep the active thumbnail in view as the user scrolls the document.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [current])

  return (
    <nav className="ws-sidebar" aria-label="Pages">
      <ol ref={listRef}>
        {pages.map((p, i) => (
          <li key={i} data-index={i}>
            <button
              className="thumb"
              aria-current={i === current ? 'page' : undefined}
              aria-label={`Page ${i + 1}`}
              onClick={() =>
                document.getElementById(`page-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              <span
                className="thumb-page"
                style={{ width: THUMB_WIDTH, height: (THUMB_WIDTH * p.height) / p.width }}
              >
                <PageCanvas pdf={pdf} index={i} scale={THUMB_WIDTH / p.width} rootMargin="300px" />
              </span>
              <span className="thumb-label">{i + 1}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/* ─── Pages ─────────────────────────────────────────────────────── */

function Pages() {
  const pdf = useWorkspace((s) => s.pdf)!
  const pages = useWorkspace((s) => s.pages)
  const overlays = useWorkspace((s) => s.overlays)
  const scale = useWorkspace((s) => s.scale)
  const fit = useWorkspace((s) => s.fit)
  const hasFields = useWorkspace((s) => s.fields.length > 0)
  const scrollerRef = useRef<HTMLDivElement>(null)

  // Fit-to-width: recompute when the scroller resizes or fit mode is re-enabled.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const maxW = Math.max(...pages.map((p) => p.width))
    const update = () => {
      const pad = el.clientWidth < 600 ? 24 : 64
      useWorkspace.getState().setFitScale(Math.min((el.clientWidth - pad) / maxW, 1.5))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pages, fit])

  // Track which page is in the middle of the viewport.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const mid = el.scrollTop + el.clientHeight / 3
        const nodes = el.querySelectorAll<HTMLElement>('.ws-page')
        let idx = 0
        nodes.forEach((n, i) => {
          if (n.offsetTop <= mid) idx = i
        })
        if (idx !== useWorkspace.getState().currentPage) useWorkspace.getState().setCurrentPage(idx)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      className="ws-scroller"
      ref={scrollerRef}
      onPointerDown={() => {
        const s = useWorkspace.getState()
        if (s.selectedId && !s.editingId) s.select(null)
      }}
    >
      {pages.map((p, i) => {
        const w = p.width * scale
        const h = p.height * scale
        return (
          <section
            key={i}
            id={`page-${i}`}
            className="ws-page"
            style={{ width: w, height: h }}
            aria-label={`Page ${i + 1}`}
          >
            <PageCanvas pdf={pdf} index={i} scale={scale} hideForms={hasFields} />
            {hasFields && <FormLayer page={i} pageW={w} pageH={h} />}
            {overlays
              .filter((o) => o.page === i)
              .map((o) => (
                <OverlayItem key={o.id} overlay={o} pageW={w} pageH={h} />
              ))}
          </section>
        )
      })}
    </div>
  )
}
