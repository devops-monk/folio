import { expect, test, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts, degrees } from '@cantoo/pdf-lib'
import { readFile } from 'node:fs/promises'

async function fixturePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const p1 = doc.addPage([612, 792])
  p1.drawText('Fixture page one', { x: 72, y: 720, size: 24, font })
  const p2 = doc.addPage([612, 792])
  p2.drawText('Rotated page two', { x: 72, y: 720, size: 24, font })
  p2.setRotation(degrees(90))
  return Buffer.from(await doc.save())
}

async function openEditor(page: Page) {
  await page.goto('#/edit-pdf')
  await page.locator('input[type=file]').setInputFiles({
    name: 'fixture.pdf',
    mimeType: 'application/pdf',
    buffer: await fixturePdf(),
  })
  await expect(page.locator('.ws-page')).toHaveCount(2)
}

async function pdfText(path: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(await readFile(path)),
    standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
  }).promise
  const page = await doc.getPage(1)
  const content = await page.getTextContent()
  return content.items
    .filter((i) => 'str' in i)
    .map((i) => ({ str: (i as { str: string }).str, x: (i as { transform: number[] }).transform[4], y: (i as { transform: number[] }).transform[5] }))
}

test('add, move, undo/redo and download text', async ({ page }) => {
  await openEditor(page)

  await page.getByRole('button', { name: 'Text', exact: true }).click()
  const textarea = page.getByLabel('Edit text')
  await expect(textarea).toBeFocused()
  await textarea.fill('Hello Folio')
  await textarea.press('Escape')

  const overlay = page.locator('.overlay[data-kind=text]')
  await expect(overlay).toHaveText('Hello Folio')
  const start = (await overlay.boundingBox())!

  // Drag it by its middle 80px right and 60px down.
  const cx = start.x + start.width / 2
  const cy = start.y + start.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 40, cy + 30, { steps: 4 })
  await page.mouse.move(cx + 80, cy + 60, { steps: 4 })
  await page.mouse.up()
  const moved = (await overlay.boundingBox())!
  expect(moved.x - start.x).toBeCloseTo(80, 0)
  expect(moved.y - start.y).toBeCloseTo(60, 0)

  // Undo restores the position, redo re-applies it.
  await page.getByRole('button', { name: 'Undo' }).click()
  expect((await overlay.boundingBox())!.x).toBeCloseTo(start.x, 0)
  await page.getByRole('button', { name: 'Redo' }).click()
  expect((await overlay.boundingBox())!.x).toBeCloseTo(moved.x, 0)

  // Where the text sits on the page, in PDF points.
  const pageBox = (await page.locator('.ws-page').first().boundingBox())!
  const k = 612 / pageBox.width
  const expectedX = (moved.x - pageBox.x) * k
  const expectedBaseline = 792 - ((moved.y - pageBox.y) * k + 0.9465 * 16)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download/ }).click(),
  ])
  expect(download.suggestedFilename()).toBe('fixture-edited.pdf')
  const items = await pdfText((await download.path())!)
  const hello = items.find((i) => i.str === 'Hello Folio')
  expect(hello, JSON.stringify(items)).toBeTruthy()
  expect(Math.abs(hello!.x - expectedX)).toBeLessThan(2)
  expect(Math.abs(hello!.y - expectedBaseline)).toBeLessThan(2)
  expect(items.some((i) => i.str === 'Fixture page one')).toBe(true)
})

test('whiteout box can be added, recolored and deleted', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('button', { name: 'Whiteout' }).click()
  const box = page.locator('.overlay[data-kind=rect]')
  await expect(box).toHaveCount(1)
  await expect(page.getByRole('complementary', { name: 'Inspector' }).getByText('Shape')).toBeVisible()
  await page.getByRole('radio', { name: '#ffd60a' }).click()
  await expect(box.locator('.overlay-rect')).toHaveCSS('background-color', 'rgb(255, 214, 10)')
  await page.getByRole('complementary', { name: 'Inspector' }).getByRole('button', { name: 'Delete' }).click()
  await expect(box).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(box).toHaveCount(1)
})

test('rejects password-protected or broken files gracefully', async ({ page }) => {
  await page.goto('#/edit-pdf')
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7 not really a pdf'),
  })
  await expect(page.getByText(/valid PDF|couldn’t open/)).toBeVisible()
  await page.getByRole('button', { name: 'Choose another file' }).click()
  await expect(page.getByRole('button', { name: 'Choose a PDF' })).toBeVisible()
})
