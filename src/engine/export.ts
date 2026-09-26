import { drawOverlays } from './flatten'
import { applyFormValues, saveForm, type FieldValue } from './forms'
import { loadPdf } from './load'
import type { Overlay } from './overlays'

/** A page replaced by a flat image (used for redaction). */
export interface PageImage {
  page: number
  jpg: Uint8Array
  /** Display size in points. */
  width: number
  height: number
}

export interface ExportOptions {
  overlays: Overlay[]
  /** Only fields the user changed. */
  formValues: Record<string, FieldValue>
  /** Burn form fields into the page so they can no longer be edited. */
  flattenForm: boolean
  /** Pages to replace with images (redacted pages, already burned in). */
  pageImages?: PageImage[]
}

/** Produces the final PDF from the original bytes plus everything done in the workspace. */
export async function exportDocument(input: Uint8Array, opts: ExportOptions): Promise<Uint8Array> {
  const doc = await loadPdf(input)
  const hasForm = Object.keys(opts.formValues).length > 0 || opts.flattenForm
  if (hasForm) applyFormValues(doc, opts.formValues)

  for (const pi of opts.pageImages ?? []) {
    // New unrotated page at the displayed size, so display-space overlays still line up.
    const img = await doc.embedJpg(pi.jpg)
    const page = doc.insertPage(pi.page, [pi.width, pi.height])
    page.drawImage(img, { x: 0, y: 0, width: pi.width, height: pi.height })
    doc.removePage(pi.page + 1)
  }
  if (opts.pageImages?.length) {
    // Redacted documents shouldn't leak details through their properties.
    doc.setTitle('')
    doc.setAuthor('')
    doc.setSubject('')
    doc.setKeywords([])
    doc.setCreator('')
    doc.setProducer('Folio')
  }

  await drawOverlays(doc, opts.overlays.filter((o) => !(o.kind === 'rect' && o.redact)))
  return hasForm ? saveForm(doc, opts.flattenForm) : doc.save()
}
