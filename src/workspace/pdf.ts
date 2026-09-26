import type { PDFDocumentLoadingTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let lib: Promise<typeof import('pdfjs-dist')> | undefined

/** Loads pdf.js on first use so the home page stays lightweight. */
export function loadPdfjs() {
  lib ??= import('pdfjs-dist').then((m) => {
    m.GlobalWorkerOptions.workerSrc = workerUrl
    return m
  })
  return lib
}

/** Starts loading a PDF. Call `.destroy()` on the task to free its worker resources. */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentLoadingTask> {
  const pdfjs = await loadPdfjs()
  const asset = (dir: string) => new URL(`pdfjs/${dir}/`, document.baseURI).href
  return pdfjs.getDocument({
    // pdf.js transfers the buffer to its worker, so hand it a copy.
    data: bytes.slice(),
    cMapUrl: asset('cmaps'),
    standardFontDataUrl: asset('standard_fonts'),
    wasmUrl: asset('wasm'),
    iccUrl: asset('iccs'),
  })
}

export function describeOpenError(err: unknown): string {
  const name = (err as { name?: string })?.name
  if (name === 'PasswordException') {
    return 'This PDF is password-protected. Unlocking is coming soon.'
  }
  if (name === 'InvalidPDFException') {
    return 'This file doesn’t look like a valid PDF.'
  }
  return 'We couldn’t open this PDF.'
}
