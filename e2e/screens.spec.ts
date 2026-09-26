// Captures review screenshots; run with SCREENS=1.
import { test } from '@playwright/test'
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'

test.skip(!process.env.SCREENS, 'screenshots only on demand')

test('workspace screenshots', async ({ page }, info) => {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  for (let n = 1; n <= 3; n++) {
    const p = doc.addPage([612, 792])
    p.drawText('Service Agreement', { x: 72, y: 700, size: 28, font: bold })
    for (let i = 0; i < 18; i++)
      p.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.', { x: 72, y: 650 - i * 22, size: 11, font, color: rgb(0.2, 0.2, 0.2) })
    p.drawText(`Page ${n}`, { x: 290, y: 40, size: 10, font })
  }
  await page.goto('#/edit-pdf')
  await page.locator('input[type=file]').setInputFiles({ name: 'Service Agreement.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) })
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await page.getByLabel('Edit text').fill('Approved — A. Singh')
  await page.getByLabel('Edit text').press('Escape')
  await page.getByRole('button', { name: 'Highlight' }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `test-results/ws-${info.project.name}.png` })
})
