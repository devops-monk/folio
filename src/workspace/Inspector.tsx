import { Copy, Minus, MousePointerClick, Plus, TextCursorInput, Trash2 } from 'lucide-react'
import type { Overlay } from '../engine/overlays'
import { useWorkspace } from './store'

const TEXT_COLORS = ['#1d1d1f', '#8e8e93', '#0040dd', '#d70015', '#248a3d']
const FILL_COLORS = ['#ffffff', '#000000', '#ffd60a', '#34c759', '#0a84ff', '#ff375f']
const FONT_STEPS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72, 96]

function nextFontSize(size: number, dir: 1 | -1) {
  const r = Math.round(size)
  if (dir > 0) return FONT_STEPS.find((s) => s > r) ?? Math.min(400, r + 24)
  return [...FONT_STEPS].reverse().find((s) => s < r) ?? Math.max(4, r - 1)
}

/** Properties of the selected object. A side panel on desktop, a bottom sheet on phones. */
export function Inspector({ formTool = false }: { formTool?: boolean }) {
  const selected = useWorkspace((s) => s.overlays.find((o) => o.id === s.selectedId))
  const current = useWorkspace((s) => s.currentPage)
  const total = useWorkspace((s) => s.pages.length)
  const fieldCount = useWorkspace((s) => s.fields.filter((f) => f.type !== 'signature').length)
  const xfa = useWorkspace((s) => s.xfa)

  return (
    <aside
      className="ws-inspector"
      data-open={selected || (fieldCount > 0 && !xfa) ? true : undefined}
      data-compact={!selected && fieldCount > 0 ? true : undefined}
      aria-label="Inspector"
    >
      {selected ? (
        <SelectedPanel o={selected} />
      ) : fieldCount > 0 || formTool || xfa ? (
        <FormPanel fieldCount={fieldCount} xfa={xfa} current={current} total={total} />
      ) : (
        <div className="insp-empty">
          <MousePointerClick size={26} strokeWidth={1.8} aria-hidden />
          <p>Add text, an image or a shape from the toolbar, then drag it into place.</p>
          <p className="insp-page">
            Page {current + 1} of {total}
          </p>
        </div>
      )}
    </aside>
  )
}

function FormPanel({ fieldCount, xfa, current, total }: { fieldCount: number; xfa: boolean; current: number; total: number }) {
  const flatten = useWorkspace((s) => s.flattenForm)
  const changed = useWorkspace((s) => Object.keys(s.changedFields).length)
  const setFlatten = useWorkspace((s) => s.setFlattenForm)

  if (xfa) {
    return (
      <div className="insp-empty">
        <TextCursorInput size={26} strokeWidth={1.8} aria-hidden />
        <p>This is an XFA form, which browsers can’t fill. Use the Text tool to type onto the page instead.</p>
      </div>
    )
  }
  if (!fieldCount) {
    return (
      <div className="insp-empty">
        <TextCursorInput size={26} strokeWidth={1.8} aria-hidden />
        <p>This PDF has no fillable fields. Use Text to type anywhere on the page, and Sign to add a signature.</p>
        <p className="insp-page">
          Page {current + 1} of {total}
        </p>
      </div>
    )
  }
  return (
    <div className="insp-panel">
      <h2 className="insp-title insp-wide">Form</h2>
      <p className="insp-hint insp-wide">
        {fieldCount} {fieldCount === 1 ? 'field' : 'fields'} · {changed} filled in. Press Tab to jump to the next field.
      </p>
      <label className="sig-keep insp-switch">
        <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} />
        <span className="switch" aria-hidden />
        Lock fields when downloading
      </label>
      <p className="insp-hint insp-wide">Locked (flattened) forms can’t be changed by whoever receives them.</p>
    </div>
  )
}

function SelectedPanel({ o }: { o: Overlay }) {
  const { update, remove, add } = useWorkspace.getState()
  const title = o.kind === 'text' ? 'Text' : o.kind === 'image' ? 'Image' : o.redact ? 'Redaction' : 'Shape'

  return (
    <div className="insp-panel">
      <h2 className="insp-title">{title}</h2>

      {o.kind === 'text' && (
        <>
          <div className="insp-row">
            <span className="insp-label">Size</span>
            <div className="stepper">
              <button onClick={() => update(o.id, { fontSize: nextFontSize(o.fontSize, -1) })} aria-label="Smaller">
                <Minus size={15} />
              </button>
              <span className="stepper-value">{Math.round(o.fontSize)} pt</span>
              <button onClick={() => update(o.id, { fontSize: nextFontSize(o.fontSize, 1) })} aria-label="Larger">
                <Plus size={15} />
              </button>
            </div>
          </div>
          <Swatches
            label="Color"
            colors={TEXT_COLORS}
            value={o.color}
            onPick={(color) => update(o.id, { color })}
          />
          <p className="insp-hint">Double-click the text to edit it.</p>
        </>
      )}

      {o.kind === 'rect' && o.redact && (
        <p className="insp-hint">
          Everything under this box is permanently removed when you download. The page is flattened into an image, so
          its other text can no longer be selected.
        </p>
      )}

      {o.kind === 'rect' && !o.redact && (
        <>
          <Swatches label="Fill" colors={FILL_COLORS} value={o.fill} onPick={(fill) => update(o.id, { fill })} />
          <div className="insp-row">
            <span className="insp-label">Style</span>
            <div className="segmented" role="radiogroup">
              <button role="radio" aria-checked={o.opacity === 1} onClick={() => update(o.id, { opacity: 1 })}>
                Solid
              </button>
              <button role="radio" aria-checked={o.opacity < 1} onClick={() => update(o.id, { opacity: 0.4 })}>
                Highlight
              </button>
            </div>
          </div>
          {o.fill === '#000000' && o.opacity === 1 && (
            <p className="insp-hint">
              A black box only covers content visually. True redaction is coming in the Redact tool.
            </p>
          )}
        </>
      )}

      <div className="insp-actions">
        <button
          className="insp-action"
          onClick={() =>
            add({ ...o, id: crypto.randomUUID(), x: Math.min(o.x + 0.03, 1 - o.w), y: Math.min(o.y + 0.03, 1 - o.h) })
          }
        >
          <Copy size={16} /> Duplicate
        </button>
        <button className="insp-action danger" onClick={() => remove(o.id)}>
          <Trash2 size={16} /> Delete
        </button>
      </div>
    </div>
  )
}

function Swatches({
  label,
  colors,
  value,
  onPick,
}: {
  label: string
  colors: string[]
  value: string
  onPick: (c: string) => void
}) {
  return (
    <div className="insp-row">
      <span className="insp-label">{label}</span>
      <div className="swatches" role="radiogroup" aria-label={label}>
        {colors.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={value.toLowerCase() === c}
            aria-label={c}
            className="swatch"
            style={{ background: c }}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
    </div>
  )
}
