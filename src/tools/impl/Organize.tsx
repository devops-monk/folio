import { useState } from 'react'
import { Plus, RotateCcw, RotateCw } from 'lucide-react'
import { Notice, RunBar } from '../../process/controls'
import { baseName, pdfOut, type PanelProps } from '../../process/types'
import { assemble } from '../../engine/pages'
import { PageGrid } from '../../process/PageGrid'
import { initialItems, pdfsKey, useLoadedPdfs, type LoadedPdfs, type PageItem } from '../../process/pdfs'

/** Reorder, rotate, duplicate and delete pages across one or more PDFs. */
export default function Organize(props: PanelProps) {
  const pdfs = useLoadedPdfs(props.files)
  if (pdfs.status === 'error') return <Notice>{pdfs.error}</Notice>
  if (pdfs.status !== 'ready') return null
  // A fresh layout for every new set of files.
  return <OrganizeEditor key={pdfsKey(pdfs)} {...props} pdfs={pdfs} />
}

function OrganizeEditor({ files, addFiles, run, pdfs }: PanelProps & { pdfs: LoadedPdfs }) {
  const [items, setItems] = useState<PageItem[]>(() => initialItems(pdfs.sizes))

  const rotate = (key: string, delta: number) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, rotate: x.rotate + delta } : x)))
  const rotateAll = (delta: number) => setItems((xs) => xs.map((x) => ({ ...x, rotate: x.rotate + delta })))
  const remove = (key: string) => setItems((xs) => xs.filter((x) => x.key !== key))
  const duplicate = (key: string) =>
    setItems((xs) => xs.flatMap((x) => (x.key === key ? [x, { ...x, key: `${x.key}:${crypto.randomUUID()}` }] : [x])))

  const save = () =>
    run(async (progress) => {
      progress(0.3, 'Arranging pages')
      const out = await assemble(
        pdfs.bytes,
        items.map((i) => ({ file: i.file, page: i.page, rotate: i.rotate })),
      )
      return { outputs: [pdfOut(`${baseName(files[0])}-organized.pdf`, out)], summary: `${items.length} pages arranged` }
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
        <button type="button" className="chip-button" onClick={addFiles}>
          <Plus size={15} /> Add PDF
        </button>
      </div>
      <Notice tone="info">Drag pages to reorder (press and hold on touch screens). Use the buttons on each page to rotate, duplicate or delete it.</Notice>
      <PageGrid
        pdfs={pdfs}
        items={items}
        onReorder={setItems}
        onRotate={rotate}
        onDelete={items.length > 1 ? remove : undefined}
        onDuplicate={duplicate}
        colorByFile={files.length > 1}
      />
      <RunBar label="Save PDF" onClick={save} disabled={!items.length}>
        {items.length} pages{files.length > 1 ? ` from ${files.length} files` : ''}
      </RunBar>
    </div>
  )
}
