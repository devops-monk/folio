import { drawOverlays } from './flatten'
import { applyFormValues, saveForm, type FieldValue } from './forms'
import { loadPdf } from './load'
import type { Overlay } from './overlays'

export interface ExportOptions {
  overlays: Overlay[]
  /** Only fields the user changed. */
  formValues: Record<string, FieldValue>
  /** Burn form fields into the page so they can no longer be edited. */
  flattenForm: boolean
}

/** Produces the final PDF from the original bytes plus everything done in the workspace. */
export async function exportDocument(input: Uint8Array, opts: ExportOptions): Promise<Uint8Array> {
  const doc = await loadPdf(input)
  const hasForm = Object.keys(opts.formValues).length > 0 || opts.flattenForm
  if (hasForm) applyFormValues(doc, opts.formValues)
  await drawOverlays(doc, opts.overlays)
  return hasForm ? saveForm(doc, opts.flattenForm) : doc.save()
}
