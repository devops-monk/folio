import { test } from '@playwright/test'
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'

test.skip(!process.env.SCREENS, 'screenshots only on demand')

async function doc(n: number) {
  const d = await PDFDocument.create()
  const f = await d.embedFont(StandardFonts.Helvetica)
  const b = await d.embedFont(StandardFonts.HelveticaBold)
  for (let i = 1; i <= n; i++) {
    const p = d.addPage([612, 792])
    p.drawText(`Chapter ${i}`, { x: 72, y: 700, size: 30, font: b })
    for (let l = 0; l < 20; l++) p.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do.', { x: 72, y: 640 - l * 22, size: 12, font: f, color: rgb(0.25, 0.25, 0.25) })
  }
  return { name: 'Annual Report.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await d.save()) }
}

test('tool screenshots', async ({ page }, info) => {
  const shot = (n: string) => page.screenshot({ path: `test-results/tool-${n}-${info.project.name}.png` })
  await page.goto('#/organize-pdf')
  await page.locator('input[type=file]').setInputFiles(await doc(7))
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Rotate page 2 right' }).click()
  await page.waitForTimeout(500)
  await shot('organize')
  await page.goto('#/watermark-pdf')
  await page.locator('input[type=file]').setInputFiles(await doc(2))
  await page.waitForTimeout(800)
  await shot('watermark')
  await page.goto('#/compress-pdf')
  await page.locator('input[type=file]').setInputFiles(await doc(2))
  await page.waitForTimeout(400)
  await shot('compress')
  await page.getByRole('button', { name: 'Compress' }).click()
  await page.waitForTimeout(1200)
  await shot('result')
})
