import { expect, test, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts, degrees } from '@cantoo/pdf-lib'
import JSZip from 'jszip'
import { readFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'

// Tool flows are exercised on desktop; the mobile project runs a smoke subset.
test.describe.configure({ mode: 'parallel' })

async function labeled(prefix: string, n: number) {
  const d = await PDFDocument.create()
  const f = await d.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= n; i++) d.addPage([612, 792]).drawText(`${prefix}${i}`, { x: 60, y: 700, size: 28, font: f })
  return Buffer.from(await d.save())
}

const pdf = (name: string, buffer: Buffer) => ({ name, mimeType: 'application/pdf', buffer })

async function open(page: Page, tool: string, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  await page.goto(`#/${tool}`)
  await page.locator('input[type=file]').first().setInputFiles(files)
}

async function runAndDownload(page: Page, action: string | RegExp) {
  await page.getByRole('button', { name: action }).click()
  const button = page.locator('.result-actions button')
  await expect(button).toBeVisible({ timeout: 90_000 })
  const [dl] = await Promise.all([page.waitForEvent('download'), button.click()])
  return { name: dl.suggestedFilename(), bytes: new Uint8Array(await readFile((await dl.path())!)) }
}

async function unzip(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes)
  const names = Object.keys(zip.files).sort()
  return Promise.all(names.map(async (n) => ({ name: n, bytes: await zip.files[n].async('uint8array') })))
}

async function texts(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: bytes.slice(), standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise
  const out: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent()
    out.push(c.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim())
  }
  return out
}

function png(w: number, h: number, pixel: (x: number, y: number) => [number, number, number]) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    for (let x = 0; x < w; x++) raw.set(pixel(x, y), y * (w * 3 + 1) + 1 + x * 3)
  }
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b: Buffer) => {
    let c = 0xffffffff
    for (const x of b) c = table[(c ^ x) & 255] ^ (c >>> 8)
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
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// Playwright requires object destructuring for the fixtures argument.
// oxlint-disable-next-line no-empty-pattern
test.beforeEach(({}, info) => {
  test.skip(info.project.name === 'mobile' && !info.title.includes('[mobile]'), 'desktop-only flow')
})

test('merge combines files in order [mobile]', async ({ page }) => {
  await open(page, 'merge-pdf', [pdf('a.pdf', await labeled('A', 2)), pdf('b.pdf', await labeled('B', 1))])
  await expect(page.getByText('2 files · 3 pages')).toBeVisible()
  const out = await runAndDownload(page, 'Merge PDFs')
  expect(out.name).toBe('a-merged.pdf')
  expect(await texts(out.bytes)).toEqual(['A1', 'A2', 'B1'])
})

test('split by ranges downloads a zip of parts', async ({ page }) => {
  await open(page, 'split-pdf', [pdf('doc.pdf', await labeled('P', 5))])
  await page.getByLabel('Page ranges').fill('1-2, 3-5')
  await expect(page.getByText('2 files: pages 1–2, pages 3–5')).toBeVisible()
  const out = await runAndDownload(page, 'Split PDF')
  const parts = await unzip(out.bytes)
  expect(parts.map((p) => p.name)).toEqual(['doc-pages-1-2.pdf', 'doc-pages-3-5.pdf'])
  expect(await texts(parts[1].bytes)).toEqual(['P3', 'P4', 'P5'])
})

test('remove pages by typed ranges', async ({ page }) => {
  await open(page, 'remove-pages', [pdf('doc.pdf', await labeled('P', 4))])
  await page.getByLabel('Page ranges').fill('2, 4')
  const out = await runAndDownload(page, 'Remove pages')
  expect(await texts(out.bytes)).toEqual(['P1', 'P3'])
})

test('extract pages by clicking thumbnails', async ({ page }) => {
  await open(page, 'extract-pages', [pdf('doc.pdf', await labeled('P', 4))])
  await page.getByRole('button', { name: 'Page 3', exact: true }).click()
  await page.getByRole('button', { name: 'Page 1', exact: true }).click()
  await expect(page.getByText('2 of 4 selected')).toBeVisible()
  const out = await runAndDownload(page, 'Extract pages')
  expect(await texts(out.bytes)).toEqual(['P1', 'P3'])
})

test('rotate a single page', async ({ page }) => {
  await open(page, 'rotate-pdf', [pdf('doc.pdf', await labeled('P', 3))])
  await page.getByRole('button', { name: 'Page 2', exact: true }).click()
  const out = await runAndDownload(page, 'Save rotated PDF')
  const doc = await PDFDocument.load(out.bytes)
  expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 0])
})

test('organize: rotate all and delete a page [mobile]', async ({ page }) => {
  await open(page, 'organize-pdf', [pdf('doc.pdf', await labeled('P', 3))])
  await page.getByRole('button', { name: 'All right' }).click()
  await page.getByRole('button', { name: 'Delete page 2' }).click()
  const out = await runAndDownload(page, 'Save PDF')
  expect(await texts(out.bytes)).toEqual(['P1', 'P3'])
  expect((await PDFDocument.load(out.bytes)).getPages().map((p) => p.getRotation().angle)).toEqual([90, 90])
})

test('compress shrinks an image-heavy PDF and keeps text', async ({ page }) => {
  const d = await PDFDocument.create()
  const f = await d.embedFont(StandardFonts.Helvetica)
  // Photo-like image: smooth gradients plus fine noise, big as PNG, small as JPEG.
  const img = await d.embedPng(
    png(1800, 1400, (x, y) => {
      const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
      const j = Math.abs(n) * 24
      return [(x / 1800) * 200 + j, (y / 1400) * 200 + j, 120 + j]
    }),
  )
  const p = d.addPage([612, 792])
  p.drawImage(img, { x: 50, y: 300, width: 500, height: 390 })
  p.drawText('Keep me', { x: 60, y: 100, size: 20, font: f })
  const input = Buffer.from(await d.save())

  await open(page, 'compress-pdf', [pdf('photo.pdf', input)])
  const out = await runAndDownload(page, 'Compress')
  await expect(page.getByText(/Saved \d+%/)).toBeVisible()
  expect(out.bytes.length).toBeLessThan(input.length * 0.6)
  expect((await texts(out.bytes))[0]).toContain('Keep me')
})

test('pdf to images and images to pdf', async ({ page }) => {
  await open(page, 'pdf-to-jpg', [pdf('doc.pdf', await labeled('P', 2))])
  const out = await runAndDownload(page, 'Convert to images')
  const imgs = await unzip(out.bytes)
  expect(imgs.map((i) => i.name)).toEqual(['doc-1.jpg', 'doc-2.jpg'])
  expect([...imgs[0].bytes.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff])

  await open(page, 'jpg-to-pdf', [
    { name: 'one.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(imgs[0].bytes) },
    { name: 'two.png', mimeType: 'image/png', buffer: png(300, 200, () => [30, 140, 250]) },
  ])
  await page.getByRole('radio', { name: 'A4' }).click()
  const back = await runAndDownload(page, 'Create PDF')
  const doc = await PDFDocument.load(back.bytes)
  expect(doc.getPageCount()).toBe(2)
  expect(doc.getPage(1).getWidth()).toBeGreaterThan(doc.getPage(1).getHeight()) // wide image → landscape
})

test('watermark, page numbers and crop', async ({ page }) => {
  await open(page, 'watermark-pdf', [pdf('doc.pdf', await labeled('P', 2))])
  await page.getByLabel('Watermark text').fill('DRAFT COPY')
  let out = await runAndDownload(page, 'Add watermark')
  expect((await texts(out.bytes)).every((t) => t.includes('DRAFT COPY'))).toBe(true)

  await open(page, 'page-numbers', [pdf('doc.pdf', await labeled('P', 3))])
  await page.getByRole('radio', { name: 'Page 1 of N' }).click()
  out = await runAndDownload(page, 'Add page numbers')
  expect((await texts(out.bytes))[2]).toContain('Page 3 of 3')

  await open(page, 'crop-pdf', [pdf('doc.pdf', await labeled('P', 1))])
  out = await runAndDownload(page, 'Crop PDF')
  const box = (await PDFDocument.load(out.bytes)).getPage(0).getCropBox()
  expect(box.width).toBeCloseTo(612 * 0.84, 0)
})

test('protect then unlock round-trips', async ({ page }) => {
  await open(page, 'protect-pdf', [pdf('secret.pdf', await labeled('S', 1))])
  await page.getByLabel('Password', { exact: true }).fill('folio-pass')
  await page.getByLabel('Confirm password').fill('folio-pass')
  const locked = await runAndDownload(page, 'Protect PDF')
  await expect(PDFDocument.load(locked.bytes)).rejects.toThrow(/encrypted/)

  await open(page, 'unlock-pdf', [pdf('secret-protected.pdf', Buffer.from(locked.bytes))])
  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'Unlock PDF' }).click()
  await expect(page.getByText('That password isn’t right')).toBeVisible()
  await page.getByLabel('Password').fill('folio-pass')
  const unlocked = await runAndDownload(page, 'Unlock PDF')
  expect(await texts(unlocked.bytes)).toEqual(['S1'])
})

test('repair recovers a file with a broken cross-reference table', async ({ page }) => {
  const good = await labeled('R', 2)
  // Corrupt the xref offsets so strict readers fail.
  const broken = Buffer.from(good.toString('latin1').replace(/startxref\s+\d+/, 'startxref\n999999'), 'latin1')
  await open(page, 'repair-pdf', [pdf('broken.pdf', broken)])
  const out = await runAndDownload(page, 'Repair PDF')
  expect((await PDFDocument.load(out.bytes)).getPageCount()).toBe(2)
})

test('compare finds the changed page', async ({ page }) => {
  const a = await labeled('V', 2)
  const d = await PDFDocument.load(a)
  const f = await d.embedFont(StandardFonts.Helvetica)
  d.getPage(1).drawText('New clause added', { x: 60, y: 500, size: 18, font: f })
  await open(page, 'compare-pdf', [pdf('v1.pdf', a), pdf('v2.pdf', Buffer.from(await d.save()))])
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await expect(page.getByText('1 of 2 pages changed')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel('Page 2').getByText(/Changed/)).toBeVisible()
  await expect(page.getByLabel('Page 1').getByText('Same')).toBeVisible()
})

test('ocr adds searchable text', async ({ page }) => {
  test.setTimeout(120_000)
  const external: string[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    const own = new URL(process.env.BASE_URL ?? 'http://localhost:4173/').hostname
    if (![own, 'localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(r.url())
  })
  // An image-only page (a "scan"): real text rasterized in the browser, no text layer.
  await page.goto('#/')
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 1400
    c.height = 360
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#111'
    ctx.font = '64px Arial'
    ctx.fillText('Invoice number 4821', 60, 140)
    ctx.fillText('Total due: 120 dollars', 60, 260)
    return c.toDataURL('image/png')
  })
  const d = await PDFDocument.create()
  const img = await d.embedPng(Buffer.from(dataUrl.split(',')[1], 'base64'))
  d.addPage([612, 200]).drawImage(img, { x: 20, y: 20, width: 572, height: 147 })
  await open(page, 'ocr-pdf', [pdf('scan.pdf', Buffer.from(await d.save()))])
  const out = await runAndDownload(page, 'Make searchable')
  const text = (await texts(out.bytes))[0]
  expect(text).toContain('Invoice')
  expect(text).toContain('4821')
  // Privacy: the model and engine come from this site, never a CDN.
  expect(external).toEqual([])
})

test('redact removes the covered text for real', async ({ page }) => {
  const d = await PDFDocument.create()
  const f = await d.embedFont(StandardFonts.Helvetica)
  const p = d.addPage([612, 792])
  p.drawText('Public heading', { x: 60, y: 740, size: 18, font: f })
  // Where the new redaction box lands by default (centered, a little above middle).
  p.drawText('SECRET-4242', { x: 250, y: 468, size: 12, font: f })
  d.addPage([612, 792]).drawText('Untouched page', { x: 60, y: 740, size: 18, font: f })

  await page.goto('#/redact-pdf')
  await page.locator('input[type=file]').setInputFiles(pdf('memo.pdf', Buffer.from(await d.save())))
  await page.getByRole('button', { name: 'Redact' }).click()
  const box = page.locator('.overlay[data-kind=rect]')
  await expect(box).toHaveCount(1)
  // Resize the box generously over the secret line.
  const b = (await box.boundingBox())!
  await page.mouse.move(b.x + b.width - 1, b.y + b.height - 1)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width + 60, b.y + b.height + 30, { steps: 5 })
  await page.mouse.up()

  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  expect(dl.suggestedFilename()).toBe('memo-redacted.pdf')
  const t = await texts(new Uint8Array(await readFile((await dl.path())!)))
  expect(t[0]).not.toContain('SECRET')
  expect(t[1]).toBe('Untouched page')
})

test('rotated source pages keep working in organize', async ({ page }) => {
  const d = await PDFDocument.load(await labeled('Q', 2))
  d.getPage(0).setRotation(degrees(90))
  await open(page, 'organize-pdf', [pdf('rot.pdf', Buffer.from(await d.save()))])
  await page.getByRole('button', { name: 'Rotate page 1 left' }).click()
  const out = await runAndDownload(page, 'Save PDF')
  expect((await PDFDocument.load(out.bytes)).getPages().map((p) => p.getRotation().angle)).toEqual([0, 0])
})
