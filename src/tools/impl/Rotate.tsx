import { useState } from 'react'
import { RotateCcw, RotateCw } from 'lucide-react'
import { Notice, RunBar } from '../../process/controls'
import { baseName, pdfOut, type PanelProps } from '../../process/types'
import { rotatePages } from '../../engine/pages'
import { PageGrid } from '../../process/PageGrid'
import { initialItems, pdfsKey, useLoadedPdfs, type LoadedPdfs, type PageItem } from '../../process/pdfs'

export default function Rotate(props: PanelProps) {
  const pdfs = useLoadedPdfs(props.files)
  if (pdfs.status === 'error') return <Notice>{pdfs.error}</Notice>
  if (pdfs.status !== 'ready') return null
  return <RotateEditor key={pdfsKey(pdfs)} {...props} pdfs={pdfs} />
}

function RotateEditor({ files, run, pdfs }: PanelProps & { pdfs: LoadedPdfs }) {
  const [items, setItems] = useState<PageItem[]>(() => initialItems(pdfs.sizes))

  const rotate = (key: string, d: number) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, rotate: x.rotate + d } : x)))
  const rotateAll = (d: number) => setItems((xs) => xs.map((x) => ({ ...x, rotate: x.rotate + d })))
  const changed = items.filter((i) => ((i.rotate % 360) + 360) % 360 !== 0)

  const save = () =>
    run(async (progress) => {
      progress(0.3, 'Rotating pages')
      const out = await rotatePages(pdfs.bytes[0], new Map(items.map((i) => [i.page, i.rotate])))
      return {
        outputs: [pdfOut(`${baseName(files[0])}-rotated.pdf`, out)],
        summary: `Rotated ${changed.length} ${changed.length === 1 ? 'page' : 'pages'}`,
      }
    })

  return (
    <div className="panel">
      <div className="page-grid-toolbar">
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="chip-button" onClick={() => rotateAll(-90)}>
            <RotateCcw size={15} /> All left
          </button>
          <button type="button" className="chip-button" onClick={() => rotateAll(90)}>
            <RotateCw size={15} /> All right
          </button>
        </div>
      </div>
      <Notice tone="info">Click a page to turn it clockwise, or use the arrows on each page.</Notice>
      <PageGrid
        pdfs={pdfs}
        items={items}
        mode="select"
        selected={new Set(changed.map((c) => c.key))}
        onToggle={(k) => rotate(k, 90)}
        onRotate={rotate}
      />
      <RunBar label="Save rotated PDF" onClick={save} disabled={!changed.length}>
        {changed.length} of {items.length} pages rotated
      </RunBar>
    </div>
  )
}
