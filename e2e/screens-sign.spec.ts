import { test } from '@playwright/test'
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib'

test.skip(!process.env.SCREENS, 'screenshots only on demand')

test('sign screenshots', async ({ page }, info) => {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const p = doc.addPage([612, 792])
  p.drawText('Mortgage Offer Acceptance', { x: 72, y: 700, size: 24, font })
  p.drawText('Signature: ______________________', { x: 72, y: 300, size: 14, font })
  await page.goto('#/sign-pdf')
  await page.locator('input[type=file]').setInputFiles({ name: 'offer.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) })
  const pad = page.getByLabel('Signature drawing area')
  const b = (await pad.boundingBox())!
  await page.mouse.move(b.x + 50, b.y + 130)
  await page.mouse.down()
  for (let i = 0; i <= 40; i++) await page.mouse.move(b.x + 50 + i * 7, b.y + 115 + Math.sin(i / 2.2) * 35 - i * 0.6)
  await page.mouse.up()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `test-results/sign-draw-${info.project.name}.png` })
  await page.getByRole('tab', { name: 'Type' }).click()
  await page.getByLabel('Your name').fill('Abhay Singh')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `test-results/sign-type-${info.project.name}.png` })
  await page.getByRole('button', { name: 'Insert' }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `test-results/sign-placed-${info.project.name}.png` })
})
