import { loadPdf } from './load'

export interface ProtectOptions {
  /** Needed to open the file. */
  password: string
  /** Allow printing without the owner password. */
  allowPrinting: boolean
  /** Allow copying text and images. */
  allowCopying: boolean
  /** Allow editing, annotating and filling forms. */
  allowEditing: boolean
}

/** Encrypts with AES-256. The owner password is random, so restrictions can't be lifted with the open password. */
export async function protectPdf(input: Uint8Array, opts: ProtectOptions): Promise<Uint8Array> {
  const doc = await loadPdf(input)
  const owner = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('')
  doc.encrypt({
    userPassword: opts.password,
    ownerPassword: owner,
    permissions: {
      printing: opts.allowPrinting ? 'highResolution' : false,
      copying: opts.allowCopying,
      modifying: opts.allowEditing,
      annotating: opts.allowEditing,
      fillingForms: opts.allowEditing,
      contentAccessibility: true,
      documentAssembly: opts.allowEditing,
    },
  })
  return doc.save()
}

/** Removes the password (the user must know it) and all restrictions. */
export async function unlockPdf(input: Uint8Array, password: string): Promise<Uint8Array> {
  const doc = await loadPdf(input, password)
  return doc.save()
}
