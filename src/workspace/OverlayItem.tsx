import { useLayoutEffect, useRef, type CSSProperties, type PointerEvent, type RefObject } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { TEXT_FONT_STACK, TEXT_LINE_HEIGHT, type Overlay } from '../engine/overlays'
import { useWorkspace } from './store'

type Corner = 'nw' | 'ne' | 'sw' | 'se'
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const MIN_PX = 12

interface Props {
  overlay: Overlay
  /** Rendered page size in CSS pixels. */
  pageW: number
  pageH: number
}

interface Gesture {
  mode: 'move' | Corner
  px: number
  py: number
  start: Overlay
  moved: boolean
  wasSelected: boolean
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function OverlayItem({ overlay: o, pageW, pageH }: Props) {
  const selected = useWorkspace((s) => s.selectedId === o.id)
  const editing = useWorkspace((s) => s.editingId === o.id)
  const { select, patch, checkpoint, dropCheckpoint, setEditing, remove, discard, add } =
    useWorkspace.getState()
  const gesture = useRef<Gesture | null>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const editStartText = useRef('')

  // Text boxes size themselves to their content; keep w/h in sync for hit-testing and handles.
  useLayoutEffect(() => {
    if (o.kind !== 'text' || !textRef.current || !pageW || !pageH) return
    const w = textRef.current.offsetWidth / pageW
    const h = textRef.current.offsetHeight / pageH
    if (Math.abs(w - o.w) > 0.0005 || Math.abs(h - o.h) > 0.0005) patch(o.id, { w, h })
  })

  const begin = (e: PointerEvent, mode: Gesture['mode']) => {
    if (editing || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    gesture.current = { mode, px: e.clientX, py: e.clientY, start: o, moved: false, wasSelected: selected }
    select(o.id)
    checkpoint()
  }

  const move = (e: PointerEvent) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.px
    const dy = e.clientY - g.py
    if (!g.moved && Math.hypot(dx, dy) < 3) return
    g.moved = true
    const s = g.start

    if (g.mode === 'move') {
      patch(o.id, {
        x: clamp(s.x + dx / pageW, 0, 1 - s.w),
        y: clamp(s.y + dy / pageH, 0, 1 - s.h),
      })
      return
    }

    // Resize in pixels, anchored at the opposite corner.
    const sw = s.w * pageW
    const sh = s.h * pageH
    let w = g.mode.includes('e') ? sw + dx : sw - dx
    let h = g.mode.includes('s') ? sh + dy : sh - dy
    const keepAspect = s.kind !== 'rect'
    if (keepAspect) {
      const k = Math.max(MIN_PX / Math.min(sw, sh), (w / sw + h / sh) / 2)
      w = sw * k
      h = sh * k
    } else {
      w = Math.max(MIN_PX, w)
      h = Math.max(MIN_PX, h)
    }
    const x = g.mode.includes('w') ? s.x * pageW + sw - w : s.x * pageW
    const y = g.mode.includes('n') ? s.y * pageH + sh - h : s.y * pageH
    const changes: Partial<Overlay> = { x: x / pageW, y: y / pageH, w: w / pageW, h: h / pageH }
    if (s.kind === 'text') {
      ;(changes as Partial<typeof s>).fontSize = clamp((s.fontSize * w) / sw, 4, 400)
    }
    patch(o.id, changes)
  }

  const end = () => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (!g.moved) {
      dropCheckpoint()
      // Tapping an already-selected text box starts editing, like Preview/Keynote.
      if (g.mode === 'move' && g.wasSelected && o.kind === 'text') startEditing()
    }
  }

  const startEditing = () => {
    if (o.kind !== 'text') return
    editStartText.current = o.text
    checkpoint()
    setEditing(o.id)
  }

  const finishEditing = () => {
    if (o.kind !== 'text') return
    setEditing(null)
    if (!o.text.trim()) {
      // An emptied box disappears. If it started empty (a new box), the whole
      // session leaves no trace in history; otherwise undo brings the text back.
      discard(o.id)
      if (!editStartText.current.trim()) dropCheckpoint()
    } else if (o.text === editStartText.current) {
      dropCheckpoint()
    }
  }

  const duplicate = () => {
    const dy = Math.min(0.03, 1 - o.y - o.h)
    add({ ...o, id: crypto.randomUUID(), x: Math.min(o.x + 0.03, 1 - o.w), y: o.y + dy })
  }

  const style: CSSProperties = {
    left: o.x * pageW,
    top: o.y * pageH,
    ...(o.kind === 'text' ? {} : { width: o.w * pageW, height: o.h * pageH }),
  }

  return (
    <div
      className="overlay"
      data-kind={o.kind}
      data-selected={selected || undefined}
      data-editing={editing || undefined}
      style={style}
      onPointerDown={(e) => begin(e, 'move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={startEditing}
      role="group"
      aria-label={o.kind === 'text' ? `Text: ${o.text}` : o.kind === 'image' ? 'Image' : 'Shape'}
    >
      {o.kind === 'text' && (
        <TextBody overlay={o} pageW={pageW} textRef={textRef} editing={editing} onDone={finishEditing} />
      )}
      {o.kind === 'image' && <img src={o.src} alt="" draggable={false} />}
      {o.kind === 'rect' && <div className="overlay-rect" style={{ background: o.fill, opacity: o.opacity }} />}

      {selected && !editing && (
        <>
          {corners.map((c) => (
            <span
              key={c}
              className={`handle handle-${c}`}
              onPointerDown={(e) => begin(e, c)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            />
          ))}
          <div className="overlay-actions" onPointerDown={(e) => e.stopPropagation()}>
            <button onClick={duplicate} aria-label="Duplicate" title="Duplicate">
              <Copy size={15} strokeWidth={2.2} />
            </button>
            <button onClick={() => remove(o.id)} aria-label="Delete" title="Delete">
              <Trash2 size={15} strokeWidth={2.2} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function TextBody({
  overlay: o,
  pageW,
  textRef,
  editing,
  onDone,
}: {
  overlay: Extract<Overlay, { kind: 'text' }>
  pageW: number
  textRef: RefObject<HTMLDivElement | null>
  editing: boolean
  onDone: () => void
}) {
  const patch = useWorkspace.getState().patch
  const pts = useWorkspace((s) => s.pages[o.page])
  // CSS px per PDF point on this page.
  const k = pts ? pageW / pts.width : 1
  const textStyle: CSSProperties = {
    fontFamily: TEXT_FONT_STACK,
    fontSize: o.fontSize * k,
    lineHeight: TEXT_LINE_HEIGHT,
    color: o.color,
  }
  return (
    <>
      <div ref={textRef} className="overlay-text" style={{ ...textStyle, visibility: editing ? 'hidden' : undefined }}>
        {o.text || ' '}
        {o.text.endsWith('\n') ? '​' : ''}
      </div>
      {editing && (
        <textarea
          className="overlay-textarea"
          style={textStyle}
          value={o.text}
          autoFocus
          spellCheck={false}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => patch(o.id, { text: e.target.value })}
          onBlur={onDone}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') e.currentTarget.blur()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Edit text"
        />
      )}
    </>
  )
}
