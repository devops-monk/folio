import { EncryptedPDFError, PDFDict, PDFDocument, PDFName, PDFStream } from '@cantoo/pdf-lib'

export class WrongPasswordError extends Error {
  constructor() {
    super('The password is incorrect.')
    this.name = 'WrongPasswordError'
  }
}

export class PasswordRequiredError extends Error {
  constructor() {
    super('This PDF needs a password to open.')
    this.name = 'PasswordRequiredError'
  }
}

/**
 * Removes every trace of the original encryption from a document that was
 * opened with its password, so saving produces a plain PDF. The fork deletes
 * the trailer entry itself, but copied cross-reference streams and the
 * /Encrypt dictionary can survive and make the output look encrypted again.
 */
function stripEncryption(doc: PDFDocument) {
  const ctx = doc.context
  delete (ctx.trailerInfo as { Encrypt?: unknown }).Encrypt
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFDict ? obj : obj instanceof PDFStream ? obj.dict : undefined
    if (!dict) continue
    const isXRef = dict.get(PDFName.of('Type')) === PDFName.of('XRef')
    const isEncrypt = dict.get(PDFName.of('Filter')) === PDFName.of('Standard') && dict.has(PDFName.of('O'))
    if (isXRef || isEncrypt) ctx.delete(ref)
  }
}

/**
 * Loads a PDF for modification. Files that are encrypted only with an owner
 * password (e.g. "no editing" restrictions, very common on official forms)
 * open with the empty user password and are saved unencrypted; otherwise
 * `password` is required.
 */
export async function loadPdf(input: Uint8Array, password?: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(input.slice(), { updateMetadata: false })
  } catch (err) {
    if (!(err instanceof EncryptedPDFError)) throw err
  }
  for (const pw of password !== undefined ? [password] : ['']) {
    try {
      const doc = await PDFDocument.load(input.slice(), { password: pw, updateMetadata: false })
      stripEncryption(doc)
      return doc
    } catch {
      // fall through
    }
  }
  throw password !== undefined ? new WrongPasswordError() : new PasswordRequiredError()
}

export async function isEncrypted(input: Uint8Array): Promise<boolean> {
  try {
    await PDFDocument.load(input.slice(), { updateMetadata: false })
    return false
  } catch (err) {
    return err instanceof EncryptedPDFError
  }
}
