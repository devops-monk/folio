import type { CSSProperties } from 'react'
import { Signature } from 'lucide-react'
import { useWorkspace, type FormWidget } from './store'

interface Props {
  page: number
  /** Rendered page size in CSS pixels. */
  pageW: number
  pageH: number
}

/** Native inputs placed over the PDF's form fields, like Preview's form filling. */
export function FormLayer({ page, pageW, pageH }: Props) {
  const widgets = useWorkspace((s) => s.fields)
  const values = useWorkspace((s) => s.formValues)
  const pts = useWorkspace((s) => s.pages[page])
  const { setField, requestSignature } = useWorkspace.getState()
  const onPage = widgets.filter((w) => w.page === page)
  if (!onPage.length) return null

  // CSS px per PDF point.
  const k = pageW / pts.width

  return (
    <div className="form-layer" onPointerDown={(e) => e.stopPropagation()}>
      {onPage.map((w) => {
        const box: CSSProperties = {
          left: w.x * pageW,
          top: w.y * pageH,
          width: w.w * pageW,
          height: w.h * pageH,
        }
        const heightPx = w.h * pageH
        const fontSize = w.fontSize > 0 ? w.fontSize * k : w.multiline ? 11 * k : Math.min(heightPx * 0.68, 13 * k)
        const label = w.name
        const value = values[w.name]

        switch (w.type) {
          case 'text':
            return w.multiline ? (
              <textarea
                key={w.id}
                className="ff ff-text"
                style={{ ...box, fontSize, textAlign: w.align }}
                value={String(value ?? '')}
                readOnly={w.readOnly}
                maxLength={w.maxLen}
                aria-label={label}
                onChange={(e) => setField(w.name, e.target.value)}
              />
            ) : (
              <input
                key={w.id}
                className="ff ff-text"
                style={{
                  ...box,
                  fontSize,
                  textAlign: w.align,
                  ...(w.comb && w.maxLen
                    ? { letterSpacing: `calc(${(w.w * pageW) / w.maxLen}px - 1ch)`, paddingLeft: `calc(${(w.w * pageW) / w.maxLen / 2}px - 0.5ch)` }
                    : {}),
                }}
                value={String(value ?? '')}
                readOnly={w.readOnly}
                maxLength={w.maxLen}
                aria-label={label}
                onChange={(e) => setField(w.name, e.target.value)}
              />
            )
          case 'checkbox':
            return (
              <label key={w.id} className="ff ff-check" style={box}>
                <input
                  type="checkbox"
                  checked={!!value}
                  disabled={w.readOnly}
                  aria-label={label}
                  onChange={(e) => setField(w.name, e.target.checked)}
                />
                <span aria-hidden />
              </label>
            )
          case 'radio':
            return (
              <label key={w.id} className="ff ff-check ff-radio" style={box}>
                <input
                  type="radio"
                  name={`ff-${w.name}`}
                  checked={!!w.onValue && value === w.onValue}
                  disabled={w.readOnly}
                  aria-label={`${label}: ${w.onValue}`}
                  onChange={() => setField(w.name, w.onValue ?? '')}
                />
                <span aria-hidden />
              </label>
            )
          case 'select':
            return (
              <select
                key={w.id}
                className="ff ff-select"
                style={{ ...box, fontSize }}
                value={String(value ?? '')}
                disabled={w.readOnly}
                aria-label={label}
                onChange={(e) => setField(w.name, e.target.value)}
              >
                <option value="">{' '}</option>
                {w.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )
          case 'signature':
            return (
              <button
                key={w.id}
                className="ff ff-sign"
                style={box}
                onClick={() => requestSignature({ page, x: w.x, y: w.y, w: w.w, h: w.h })}
                aria-label={`Sign: ${label}`}
              >
                <Signature size={Math.min(18, heightPx * 0.6)} aria-hidden />
                {heightPx > 16 && <span>Sign here</span>}
              </button>
            )
        }
      })}
    </div>
  )
}

export type { FormWidget }
