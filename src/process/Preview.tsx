import type { ReactNode } from 'react'
import { PageCanvas } from '../workspace/PageCanvas'
import type { LoadedPdfs } from './pdfs'

/**
 * First page of the document with an overlay drawn in page-relative units,
 * for live previews of watermark, page numbers and crop settings.
 * `children` receives the rendered width so overlays can scale font sizes.
 */
export function FirstPagePreview({ pdfs, width = 280, children }: { pdfs: LoadedPdfs; width?: number; children?: (scale: number) => ReactNode }) {
  if (pdfs.status !== 'ready') return <div className="preview-box" style={{ minHeight: 320 }} />
  const size = pdfs.sizes[0][0]
  const scale = width / size.w
  return (
    <div className="preview-box">
      <div
        style={{
          position: 'relative',
          width,
          height: size.h * scale,
          background: '#fff',
          overflow: 'hidden',
          borderRadius: 3,
          boxShadow: '0 0 0 0.5px rgba(0,0,0,.12), var(--shadow-md)',
        }}
        aria-label="Preview of page 1"
        role="img"
      >
        <PageCanvas pdf={pdfs.docs[0]} index={0} scale={scale} />
        {children?.(scale)}
      </div>
    </div>
  )
}
