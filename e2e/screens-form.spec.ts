import { test } from '@playwright/test'
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib'

test.skip(!process.env.SCREENS, 'screenshots only on demand')

test('form screenshots', async ({ page }, info) => {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const p = doc.addPage([612, 792])
  p.drawText('Mortgage Offer Acceptance', { x: 72, y: 720, size: 22, font: bold })
  const form = doc.getForm()
  const rows: [string, number][] = [['Full name', 660], ['Email', 620], ['Loan reference', 580]]
  for (const [label, y] of rows) {
    p.drawText(label, { x: 72, y: y + 6, size: 11, font })
    form.createTextField(label).addToPage(p, { x: 190, y, width: 300, height: 22 })
  }
  p.drawText('I accept the offer terms', { x: 96, y: 534, size: 11, font })
  form.createCheckBox('accept').addToPage(p, { x: 72, y: 530, width: 16, height: 16 })
  await page.goto('#/fill-form')
  await page.locator('input[type=file]').setInputFiles({ name: 'Mortgage Offer Acceptance Form.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) })
  await page.getByLabel('Full name').fill('Abhay Pratap Singh')
  await page.getByLabel('Email').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `test-results/form-${info.project.name}.png` })
})
