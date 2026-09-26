import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

// Keep canvases under ~16 MP so large zooms don't exhaust memory on phones.
const MAX_PIXELS = 16_000_000

interface Props {
  pdf: PDFDocumentProxy
  /** Zero-based page index. */
  index: number
  /** CSS pixels per PDF point. */
  scale: number
  /** Margin at which rendering starts before the page scrolls into view. */
  rootMargin?: string
  /** Skip drawing form-field appearances (live inputs are layered on top instead). */
  hideForms?: boolean
}

// pdf.js AnnotationMode.ENABLE_FORMS: render annotations except interactive form widgets.
const ANNOTATION_MODE_ENABLE_FORMS = 2

/** Renders one PDF page to a canvas, lazily, once it approaches the viewport. */
export function PageCanvas({ pdf, index, scale, rootMargin = '600px', hideForms = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])

  useEffect(() => {
    if (!visible) return
    let task: RenderTask | undefined
    let cancelled = false

    pdf.getPage(index + 1).then((page) => {
      const canvas = canvasRef.current
      if (cancelled || !canvas) return
      const viewport = page.getViewport({ scale })
      let ratio = window.devicePixelRatio || 1
      const pixels = viewport.width * viewport.height * ratio * ratio
      if (pixels > MAX_PIXELS) ratio *= Math.sqrt(MAX_PIXELS / pixels)

      // Render offscreen, then swap in, so the old image stays until the new one is ready.
      const off = document.createElement('canvas')
      off.width = Math.floor(viewport.width * ratio)
      off.height = Math.floor(viewport.height * ratio)
      task = page.render({
        canvas: off,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
        ...(hideForms ? { annotationMode: ANNOTATION_MODE_ENABLE_FORMS } : {}),
      })
      task.promise.then(
        () => {
          if (cancelled) return
          canvas.width = off.width
          canvas.height = off.height
          canvas.getContext('2d')?.drawImage(off, 0, 0)
        },
        (err: { name?: string }) => {
          if (err?.name !== 'RenderingCancelledException') console.error(err)
        },
      )
    })

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [pdf, index, scale, visible, hideForms])

  return <canvas ref={canvasRef} className="page-canvas" aria-hidden />
}
