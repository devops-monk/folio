import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { FieldValue } from '../engine/forms'

/** One on-page widget of an AcroForm field. Several widgets can share a field name. */
export interface FormWidget {
  id: string
  page: number
  name: string
  type: 'text' | 'checkbox' | 'radio' | 'select' | 'signature'
  /** Display-space fractions of the page. */
  x: number
  y: number
  w: number
  h: number
  readOnly: boolean
  multiline?: boolean
  maxLen?: number
  comb?: boolean
  /** Value this checkbox / radio button stands for when selected. */
  onValue?: string
  options?: { value: string; label: string }[]
  /** Font size in points; 0 means auto-fit. */
  fontSize: number
  align: 'left' | 'center' | 'right'
}

// pdf.js annotation data (only the fields we use).
interface WidgetData {
  annotationType: number
  id: string
  fieldType?: string
  fieldName?: string
  fieldValue?: unknown
  rect: number[]
  hidden?: boolean
  readOnly?: boolean
  multiLine?: boolean
  maxLen?: number
  comb?: boolean
  checkBox?: boolean
  radioButton?: boolean
  pushButton?: boolean
  exportValue?: string
  buttonValue?: string
  options?: { exportValue: string; displayValue: string }[]
  textAlignment?: number
  defaultAppearanceData?: { fontSize?: number }
}

const WIDGET = 20

/** Reads fillable fields from every page, positioned in display space. */
export async function readFormWidgets(pdf: PDFDocumentProxy) {
  const fields: FormWidget[] = []
  const values: Record<string, FieldValue> = {}

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const annots = (await page.getAnnotations({ intent: 'display' })) as WidgetData[]

    for (const a of annots) {
      if (a.annotationType !== WIDGET || a.hidden || !a.fieldName || a.pushButton) continue
      const type =
        a.fieldType === 'Tx'
          ? 'text'
          : a.fieldType === 'Ch'
            ? 'select'
            : a.fieldType === 'Sig'
              ? 'signature'
              : a.fieldType === 'Btn'
                ? a.radioButton
                  ? 'radio'
                  : a.checkBox
                    ? 'checkbox'
                    : null
                : null
      if (!type) continue

      const [x1, y1] = vp.convertToViewportPoint(a.rect[0], a.rect[1]) as number[]
      const [x2, y2] = vp.convertToViewportPoint(a.rect[2], a.rect[3]) as number[]
      const w: FormWidget = {
        id: a.id,
        page: p - 1,
        name: a.fieldName,
        type,
        x: Math.min(x1, x2) / vp.width,
        y: Math.min(y1, y2) / vp.height,
        w: Math.abs(x2 - x1) / vp.width,
        h: Math.abs(y2 - y1) / vp.height,
        readOnly: !!a.readOnly,
        multiline: a.multiLine,
        maxLen: a.maxLen || undefined,
        comb: a.comb,
        fontSize: a.defaultAppearanceData?.fontSize ?? 0,
        align: a.textAlignment === 1 ? 'center' : a.textAlignment === 2 ? 'right' : 'left',
      }

      const raw = Array.isArray(a.fieldValue) ? a.fieldValue[0] : a.fieldValue
      if (type === 'checkbox') {
        w.onValue = a.exportValue || 'Yes'
        values[a.fieldName] ??= typeof raw === 'string' && raw !== 'Off' && raw !== ''
      } else if (type === 'radio') {
        w.onValue = a.buttonValue
        if (typeof raw === 'string' && raw !== 'Off') values[a.fieldName] = raw
        else values[a.fieldName] ??= ''
      } else if (type === 'select') {
        w.options = (a.options ?? []).map((o) => ({ value: o.exportValue, label: o.displayValue }))
        values[a.fieldName] ??= typeof raw === 'string' ? raw : ''
      } else if (type === 'text') {
        values[a.fieldName] ??= typeof raw === 'string' ? raw : ''
      }
      fields.push(w)
    }
  }
  return { fields, values }
}
