import { expect, test, type Page } from '@playwright/test'
import { PDFDocument, PDFName, PDFDict } from '@cantoo/pdf-lib'
import { readFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'

async function blankPdf(pages = 1) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([612, 792])
  return Buffer.from(await doc.save())
}

async function openSign(page: Page) {
  await page.goto('#/sign-pdf')
  await page.locator('input[type=file]').setInputFiles({ name: 'contract.pdf', mimeType: 'application/pdf', buffer: await blankPdf() })
  // Sign PDF opens the signature sheet automatically.
  await expect(page.getByRole('dialog', { name: 'Add signature' })).toBeVisible()
}

async function imageCountOnPage1(path: string) {
  const doc = await PDFDocument.load(await readFile(path))
  const res = doc.getPage(0).node.Resources()
  const xobj = res?.lookupMaybe(PDFName.of('XObject'), PDFDict)
  return xobj ? xobj.keys().length : 0
}

async function download(page: Page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  return (await dl.path())!
}

test('draw a signature, insert it and download', async ({ page }) => {
  await openSign(page)
  const pad = page.getByLabel('Signature drawing area')
  const box = (await pad.boundingBox())!
  const insert = page.getByRole('button', { name: 'Insert' })
  await expect(insert).toBeDisabled()

  // A loopy stroke across the pad.
  await page.mouse.move(box.x + 40, box.y + 120)
  await page.mouse.down()
  for (let i = 0; i <= 30; i++) {
    await page.mouse.move(box.x + 40 + i * 10, box.y + 110 + Math.sin(i / 2) * 30)
  }
  await page.mouse.up()
  await expect(insert).toBeEnabled()

  // Undo stroke empties the pad again, then redraw.
  await page.getByRole('button', { name: 'Undo last stroke' }).click()
  await expect(insert).toBeDisabled()
  await page.mouse.move(box.x + 60, box.y + 100)
  await page.mouse.down()
  await page.mouse.move(box.x + 200, box.y + 140, { steps: 10 })
  await page.mouse.move(box.x + 300, box.y + 90, { steps: 10 })
  await page.mouse.up()

  await insert.click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const sig = page.locator('.overlay[data-kind=image]')
  await expect(sig).toHaveCount(1)
  // Trimmed to the ink: wider than tall.
  const b = (await sig.boundingBox())!
  expect(b.width).toBeGreaterThan(b.height * 1.5)

  expect(await imageCountOnPage1(await download(page))).toBe(1)
})

test('typed signature is saved and reusable after reload', async ({ page }) => {
  await openSign(page)
  await page.getByRole('tab', { name: 'Type' }).click()
  await page.getByLabel('Your name').fill('Abhay Singh')
  await page.getByRole('radio', { name: 'Abhay Singh' }).nth(2).click()
  await page.getByRole('radio', { name: 'Blue' }).click()
  await page.getByRole('button', { name: 'Insert' }).click()
  await expect(page.locator('.overlay[data-kind=image]')).toHaveCount(1)

  // Reopen in a fresh session: the saved signature is offered and inserts in one click.
  await page.reload()
  await openSign(page)
  const saved = page.getByRole('button', { name: 'Use this signature' })
  await expect(saved).toHaveCount(1)
  await saved.click()
  await expect(page.locator('.overlay[data-kind=image]')).toHaveCount(1)

  // Deleting it removes it from the device.
  await page.getByRole('button', { name: 'Sign', exact: true }).click()
  await page.getByRole('button', { name: 'Delete saved signature' }).click()
  await expect(page.getByRole('button', { name: 'Use this signature' })).toHaveCount(0)
})

/** Minimal PNG encoder: black ink stroke on off-white "paper". */
function paperPng(w: number, h: number) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const ink = Math.abs(y - h / 2 - Math.sin(x / 12) * 10) < 3 && x > 20 && x < w - 20
      const v = ink ? 30 : 236
      raw.fill(v, y * (w * 3 + 1) + 1 + x * 3, y * (w * 3 + 1) + 4 + x * 3)
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b: Buffer) => {
    let c = 0xffffffff
    for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

test('uploaded signature photo gets a transparent background', async ({ page }) => {
  await openSign(page)
  await page.getByRole('tab', { name: 'Upload' }).click()
  await page.locator('.sig-upload input[type=file]').setInputFiles({ name: 'sig.png', mimeType: 'image/png', buffer: paperPng(300, 120) })
  const preview = page.getByAltText('Signature preview')
  await expect(preview).toBeVisible()
  // Corner pixel of the processed image must be transparent.
  const alpha = await preview.evaluate(async (img: HTMLImageElement) => {
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    return ctx.getImageData(1, 1, 1, 1).data[3]
  })
  expect(alpha).toBe(0)
  await page.getByRole('button', { name: 'Insert' }).click()
  await expect(page.locator('.overlay[data-kind=image]')).toHaveCount(1)
})
