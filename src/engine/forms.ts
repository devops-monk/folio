import {
  PDFBool,
  PDFCheckBox,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  type PDFDocument,
} from '@cantoo/pdf-lib'

export type FieldValue = string | boolean

/**
 * Writes form values into the document's AcroForm. Returns the names of
 * fields that couldn't be set (e.g. a radio value the file doesn't define).
 */
export function applyFormValues(doc: PDFDocument, values: Record<string, FieldValue>): string[] {
  const form = doc.getForm()
  const failed: string[] = []
  for (const [name, value] of Object.entries(values)) {
    const field = form.getFieldMaybe(name)
    if (!field) {
      failed.push(name)
      continue
    }
    try {
      if (field instanceof PDFTextField) {
        const text = String(value)
        const max = field.getMaxLength()
        field.setText(max !== undefined ? text.slice(0, max) : text)
      } else if (field instanceof PDFCheckBox) {
        if (value) field.check()
        else field.uncheck()
      } else if (field instanceof PDFRadioGroup) {
        if (typeof value === 'string' && value && value !== 'Off') field.select(value)
        else field.clear()
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        if (typeof value === 'string' && value) {
          // Free-text entry is allowed in editable combo boxes.
          if (field instanceof PDFDropdown && !field.getOptions().includes(value)) field.enableEditing()
          field.select(value)
        } else field.clear()
      }
    } catch {
      failed.push(name)
    }
  }
  return failed
}

/**
 * Saves a document with filled form fields. When appearance generation fails
 * (e.g. characters the field's font can't encode), falls back to asking the
 * viewer to render the values itself; flattening then isn't possible.
 */
export async function saveForm(doc: PDFDocument, flatten: boolean): Promise<Uint8Array> {
  const form = doc.getForm()
  try {
    form.updateFieldAppearances()
    if (flatten) form.flatten()
    return await doc.save()
  } catch {
    doc.catalog.getOrCreateAcroForm().dict.set(PDFName.of('NeedAppearances'), PDFBool.True)
    return doc.save({ updateFieldAppearances: false })
  }
}
