import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { PanelProps } from '../process/types'

type Panel = LazyExoticComponent<ComponentType<PanelProps>>

/** Options panels for one-step tools, loaded on demand. Workspace tools aren't listed here. */
export const panels: Record<string, Panel> = {
  'merge-pdf': lazy(() => import('./impl/Merge')),
  'split-pdf': lazy(() => import('./impl/Split')),
  'organize-pdf': lazy(() => import('./impl/Organize')),
  'remove-pages': lazy(() => import('./impl/SelectPages')),
  'extract-pages': lazy(() => import('./impl/SelectPages')),
  'rotate-pdf': lazy(() => import('./impl/Rotate')),
  'compress-pdf': lazy(() => import('./impl/Compress')),
  'ocr-pdf': lazy(() => import('./impl/Ocr')),
  'repair-pdf': lazy(() => import('./impl/Repair')),
  'jpg-to-pdf': lazy(() => import('./impl/ImagesToPdf')),
  'scan-to-pdf': lazy(() => import('./impl/ImagesToPdf')),
  'pdf-to-jpg': lazy(() => import('./impl/PdfToImages')),
  'watermark-pdf': lazy(() => import('./impl/Watermark')),
  'page-numbers': lazy(() => import('./impl/PageNumbers')),
  'crop-pdf': lazy(() => import('./impl/Crop')),
  'protect-pdf': lazy(() => import('./impl/Protect')),
  'unlock-pdf': lazy(() => import('./impl/Unlock')),
  'compare-pdf': lazy(() => import('./impl/Compare')),
}
