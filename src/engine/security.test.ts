import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib'
import { protectPdf, unlockPdf } from './security'
import { isEncrypted, loadPdf, PasswordRequiredError, WrongPasswordError } from './load'

async function textPdf(text: string) {
  const d = await PDFDocument.create()
  const f = await d.embedFont(StandardFonts.Helvetica)
  d.addPage().drawText(text, { font: f, x: 50, y: 700 })
  return d.save()
}

async function pageText(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({
    data: bytes.slice(),
    standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
  }).promise
  const t = await (await doc.getPage(1)).getTextContent()
  return t.items.map((i) => ('str' in i ? i.str : '')).join('')
}

describe('protect / unlock', () => {
  it('protects with a password and unlocks back to a plain PDF', async () => {
    const plain = await textPdf('top secret')
    const locked = await protectPdf(plain, { password: 'hunter2', allowPrinting: true, allowCopying: false, allowEditing: false })
    expect(await isEncrypted(locked)).toBe(true)
    await expect(loadPdf(locked)).rejects.toBeInstanceOf(PasswordRequiredError)
    await expect(unlockPdf(locked, 'nope')).rejects.toBeInstanceOf(WrongPasswordError)

    const unlocked = await unlockPdf(locked, 'hunter2')
    expect(await isEncrypted(unlocked)).toBe(false)
    expect(await pageText(unlocked)).toBe('top secret')
  })

  it('opens owner-password-only files (restrictions) without asking', async () => {
    for (const useObjectStreams of [false, true]) {
      const d = await PDFDocument.load(await textPdf('restricted form'))
      d.encrypt({ userPassword: '', ownerPassword: 'owner', permissions: { modifying: false } })
      const restricted = await d.save({ useObjectStreams })
      const doc = await loadPdf(restricted)
      const out = await doc.save({ useObjectStreams })
      expect(await isEncrypted(out)).toBe(false)
      expect(await pageText(out)).toBe('restricted form')
    }
  })
})
