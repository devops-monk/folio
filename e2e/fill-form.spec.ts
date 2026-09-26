import { expect, test, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib'
import { readFile } from 'node:fs/promises'

async function formPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([612, 792])
  page.drawText('Mortgage Offer Acceptance', { x: 72, y: 720, size: 20, font })
  const form = doc.getForm()
  const name = form.createTextField('applicant.name')
  name.setText('Prefilled')
  name.addToPage(page, { x: 72, y: 660, width: 250, height: 22 })
  const notes = form.createTextField('notes')
  notes.enableMultiline()
  notes.addToPage(page, { x: 72, y: 560, width: 300, height: 60 })
  form.createCheckBox('agree').addToPage(page, { x: 72, y: 520, width: 16, height: 16 })
  const plan = form.createRadioGroup('term')
  plan.addOptionToPage('fixed', page, { x: 72, y: 480, width: 16, height: 16 })
  plan.addOptionToPage('variable', page, { x: 120, y: 480, width: 16, height: 16 })
  const dd = form.createDropdown('country')
  dd.addOptions(['India', 'United Kingdom'])
  dd.addToPage(page, { x: 72, y: 430, width: 160, height: 22 })
  return Buffer.from(await doc.save())
}

async function open(page: Page, buffer: Buffer) {
  await page.goto('#/fill-form')
  await page.locator('input[type=file]').setInputFiles({ name: 'offer.pdf', mimeType: 'application/pdf', buffer })
  await expect(page.locator('.ws-page')).toHaveCount(1)
}

async function download(page: Page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  expect(dl.suggestedFilename()).toBe('offer-filled.pdf')
  return PDFDocument.load(await readFile((await dl.path())!))
}

test('fills every field type and downloads', async ({ page }) => {
  await open(page, await formPdf())
  const name = page.getByLabel('applicant.name')
  await expect(name).toHaveValue('Prefilled')
  await name.fill('Abhay Pratap Singh')
  await page.getByLabel('notes').fill('Line one\nLine two')
  await page.getByLabel('agree').check()
  await page.getByLabel('term: variable').check()
  await page.getByLabel('country').selectOption('United Kingdom')

  const form = (await download(page)).getForm()
  expect(form.getTextField('applicant.name').getText()).toBe('Abhay Pratap Singh')
  expect(form.getTextField('notes').getText()).toBe('Line one\nLine two')
  expect(form.getCheckBox('agree').isChecked()).toBe(true)
  expect(form.getRadioGroup('term').getSelected()).toBe('variable')
  expect(form.getDropdown('country').getSelected()).toEqual(['United Kingdom'])
})

test('lock fields flattens the form', async ({ page }) => {
  await open(page, await formPdf())
  await page.getByLabel('applicant.name').fill('Locked In')
  await page.getByRole('complementary', { name: 'Inspector' }).getByText('Lock fields when downloading').click()
  const doc = await download(page)
  expect(doc.getForm().getFields()).toHaveLength(0)
})

test('PDF without fields explains the fallback', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'inspector hint is desktop-only')
  const doc = await PDFDocument.create()
  doc.addPage()
  await open(page, Buffer.from(await doc.save()))
  await expect(page.getByText('This PDF has no fillable fields')).toBeVisible()
})
