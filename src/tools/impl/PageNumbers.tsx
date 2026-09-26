import { useState } from 'react'
import { Field, Notice, NumberInput, RunBar, Segmented, Slider, Switch } from '../../process/controls'
import { baseName, pdfOut, type PanelProps } from '../../process/types'
import { addPageNumbers, type NumberPosition } from '../../engine/stamp'
import { useLoadedPdfs } from '../../process/pdfs'
import { FirstPagePreview } from '../../process/Preview'

const FORMATS = [
  { value: '{n}', label: '1' },
  { value: 'Page {n}', label: 'Page 1' },
  { value: 'Page {n} of {total}', label: 'Page 1 of N' },
  { value: '{n} / {total}', label: '1 / N' },
]

const POSITIONS: NumberPosition[] = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']

export default function PageNumbers({ files, run }: PanelProps) {
  const pdfs = useLoadedPdfs(files)
  const [position, setPosition] = useState<NumberPosition>('bottom-center')
  const [format, setFormat] = useState(FORMATS[0].value)
  const [start, setStart] = useState(1)
  const [fontSize, setFontSize] = useState(10)
  const [skipFirst, setSkipFirst] = useState(false)
  const total = pdfs.sizes[0]?.length ?? 0
  const margin = 28

  const go = () =>
    run(async (progress) => {
      progress(0.3, 'Numbering pages')
      const out = await addPageNumbers(pdfs.bytes[0], { position, format, start, fontSize, margin, skipFirst, color: '#1d1d1f' })
      return { outputs: [pdfOut(`${baseName(files[0])}-numbered.pdf`, out)], summary: `Numbered ${skipFirst ? total - 1 : total} pages` }
    })

  if (pdfs.status === 'error') return <Notice>{pdfs.error}</Notice>
  const sample = format.replaceAll('{n}', String(start)).replaceAll('{total}', String(start + total - (skipFirst ? 2 : 1)))
  const [vert, horiz] = position.split('-')

  return (
    <div className="panel">
      <div className="two-col">
        <div className="card card-stack">
          <Field label="Position">
            <div className="position-grid" role="radiogroup" aria-label="Position">
              {POSITIONS.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={position === p} aria-label={p.replace('-', ' ')} onClick={() => setPosition(p)}>
                  <span />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Format">
            <Segmented label="Format" value={format} onChange={setFormat} options={FORMATS} />
          </Field>
          <Field label="Start at">
            <NumberInput label="First number" value={start} onChange={setStart} min={0} max={9999} />
          </Field>
          <Field label="Size">
            <Slider label="Font size" value={fontSize} onChange={setFontSize} min={6} max={24} step={1} format={(v) => `${v} pt`} />
          </Field>
          <Switch checked={skipFirst} onChange={setSkipFirst} label="Don’t number the first page (cover)" />
        </div>
        <FirstPagePreview pdfs={pdfs}>
          {(k) =>
            !skipFirst && (
              <span
                style={{
                  position: 'absolute',
                  [vert]: margin * k - (vert === 'top' ? fontSize * k * 0.2 : fontSize * k * 0.25),
                  ...(horiz === 'center' ? { left: 0, right: 0, textAlign: 'center' } : { [horiz]: margin * k }),
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  fontSize: fontSize * k,
                  color: '#1d1d1f',
                  lineHeight: 1,
                }}
              >
                {sample}
              </span>
            )
          }
        </FirstPagePreview>
      </div>
      <RunBar label="Add page numbers" onClick={go} disabled={pdfs.status !== 'ready'}>
        {total} pages
      </RunBar>
    </div>
  )
}
