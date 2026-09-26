import { useEffect, useRef, useState } from 'react'
import { ArrowUpDown, LoaderCircle } from 'lucide-react'
import { FileList } from '../../process/FileList'
import { Notice, RunBar } from '../../process/controls'
import { readBytes, type PanelProps } from '../../process/types'
import { renderPage, withPdfjs } from '../../engine/raster'

const WIDTH = 520

interface PageDiff {
  index: number
  a?: HTMLCanvasElement
  b?: HTMLCanvasElement
  /** Changed side with differences tinted red. */
  highlighted?: HTMLCanvasElement
  changed: boolean
  textChanges: number
}

async function renderAll(bytes: Uint8Array) {
  return withPdfjs(bytes, async (pdf) => {
    const pages: { canvas: HTMLCanvasElement; words: string[] }[] = []
    for (let i = 0; i < pdf.numPages; i++) {
      const vp = (await pdf.getPage(i + 1)).getViewport({ scale: 1 })
      const canvas = await renderPage(pdf, i, WIDTH / vp.width)
      const text = await (await pdf.getPage(i + 1)).getTextContent()
      const words = text.items.flatMap((it) => ('str' in it ? it.str.split(/\s+/).filter(Boolean) : []))
      pages.push({ canvas, words })
    }
    return pages
  })
}

/** Number of words added or removed (LCS-based), capped for speed on huge pages. */
function wordChanges(a: string[], b: string[]) {
  const A = a.slice(0, 1500)
  const B = b.slice(0, 1500)
  let prev = new Uint16Array(B.length + 1)
  for (let i = 1; i <= A.length; i++) {
    const cur = new Uint16Array(B.length + 1)
    for (let j = 1; j <= B.length; j++) cur[j] = A[i - 1] === B[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1])
    prev = cur
  }
  const lcs = prev[B.length]
  return A.length - lcs + (B.length - lcs)
}

function highlight(a: HTMLCanvasElement, b: HTMLCanvasElement): { canvas: HTMLCanvasElement; changed: boolean } {
  const w = b.width
  const h = b.height
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')!
  ctx.drawImage(b, 0, 0)
  const cw = Math.min(a.width, w)
  const ch = Math.min(a.height, h)
  const da = a.getContext('2d')!.getImageData(0, 0, cw, ch).data
  const db = b.getContext('2d')!.getImageData(0, 0, cw, ch).data
  const mask = ctx.getImageData(0, 0, w, h)
  let diff = 0
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4
      const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
      if (d > 90) {
        diff++
        const j = (y * w + x) * 4
        mask.data[j] = 255
        mask.data[j + 1] = Math.round(mask.data[j + 1] * 0.35)
        mask.data[j + 2] = Math.round(mask.data[j + 2] * 0.3)
      }
    }
  }
  // Size differences count as a change too.
  const changed = diff > cw * ch * 0.0002 || a.width !== b.width || Math.abs(a.height - b.height) > 2
  if (changed) ctx.putImageData(mask, 0, 0)
  return { canvas: out, changed }
}

function CanvasView({ canvas, label }: { canvas?: HTMLCanvasElement; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.replaceChildren()
    if (canvas) el.append(canvas)
  }, [canvas])
  return (
    <figure className="compare-page">
      <div ref={ref} className="compare-paper">
        {!canvas && <span className="compare-missing">No page</span>}
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

export default function Compare({ files, setFiles, addFiles }: PanelProps) {
  const [diffs, setDiffs] = useState<PageDiff[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [onlyChanged, setOnlyChanged] = useState(false)

  const compare = async () => {
    setError(null)
    setDiffs(null)
    try {
      setBusy('Rendering original')
      const a = await renderAll(await readBytes(files[0]))
      setBusy('Rendering changed version')
      const b = await renderAll(await readBytes(files[1]))
      setBusy('Finding differences')
      const out: PageDiff[] = []
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const pa = a[i]
        const pb = b[i]
        if (pa && pb) {
          const h = highlight(pa.canvas, pb.canvas)
          const t = wordChanges(pa.words, pb.words)
          out.push({ index: i, a: pa.canvas, b: pb.canvas, highlighted: h.canvas, changed: h.changed || t > 0, textChanges: t })
        } else {
          out.push({ index: i, a: pa?.canvas, b: pb?.canvas, highlighted: pb?.canvas, changed: true, textChanges: (pa ?? pb)!.words.length })
        }
      }
      setDiffs(out)
    } catch (e) {
      console.error(e)
      setError('One of the files couldn’t be read. If it’s password-protected, unlock it first.')
    } finally {
      setBusy(null)
    }
  }

  if (files.length < 2 || !diffs) {
    return (
      <div className="panel">
        <FileList files={files.slice(0, 2)} onChange={setFiles} onAdd={files.length < 2 ? addFiles : undefined} addLabel="Add the changed version" />
        {files.length === 2 && (
          <button type="button" className="chip-button" style={{ alignSelf: 'center' }} onClick={() => setFiles([files[1], files[0]])}>
            <ArrowUpDown size={15} /> Swap: “{files[1].name}” is the original
          </button>
        )}
        {files.length < 2 && <Notice tone="info">Add the second version of the document to compare.</Notice>}
        {error && <Notice>{error}</Notice>}
        <RunBar label="Compare" onClick={compare} disabled={files.length < 2} busy={!!busy}>
          {busy ?? (files.length === 2 ? 'First file is the original' : '')}
        </RunBar>
        {busy && (
          <div className="process-loading">
            <LoaderCircle className="spin" size={24} />
          </div>
        )}
      </div>
    )
  }

  const changedCount = diffs.filter((d) => d.changed).length
  const shown = onlyChanged ? diffs.filter((d) => d.changed) : diffs

  return (
    <div className="panel">
      <div className="compare-summary card">
        <strong>{changedCount === 0 ? 'No differences found' : `${changedCount} of ${diffs.length} pages changed`}</strong>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="chip-button" aria-pressed={onlyChanged} onClick={() => setOnlyChanged((v) => !v)}>
            {onlyChanged ? 'Show all pages' : 'Only changed pages'}
          </button>
          <button type="button" className="chip-button" onClick={() => setDiffs(null)}>
            Change files
          </button>
        </div>
      </div>
      {shown.map((d) => (
        <section key={d.index} className="compare-row" aria-label={`Page ${d.index + 1}`}>
          <header>
            <span>Page {d.index + 1}</span>
            <span className={`compare-badge ${d.changed ? 'changed' : ''}`}>
              {!d.a ? 'Only in changed' : !d.b ? 'Only in original' : d.changed ? `Changed${d.textChanges ? ` · ${d.textChanges} words` : ''}` : 'Same'}
            </span>
          </header>
          <div className="compare-pair">
            <CanvasView canvas={d.a} label={files[0].name} />
            <CanvasView canvas={d.highlighted} label={files[1].name} />
          </div>
        </section>
      ))}
    </div>
  )
}
