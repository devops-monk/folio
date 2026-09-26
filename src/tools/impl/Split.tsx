import { useMemo, useState } from 'react'
import { Field, Notice, NumberInput, RunBar, Segmented, TextInput } from '../../process/controls'
import { baseName, pdfOut, type PanelProps } from '../../process/types'
import { chunkPages, describeGroup, parseRanges, splitPdf } from '../../engine/pages'
import { PageGrid } from '../../process/PageGrid'
import { initialItems, useLoadedPdfs } from '../../process/pdfs'

type Mode = 'ranges' | 'every' | 'single'

export default function Split({ files, run }: PanelProps) {
  const pdfs = useLoadedPdfs(files)
  const total = pdfs.sizes[0]?.length ?? 0
  const [mode, setMode] = useState<Mode>('ranges')
  const [ranges, setRanges] = useState('')
  const [every, setEvery] = useState(1)
  const items = useMemo(() => initialItems(pdfs.sizes), [pdfs.sizes])

  let groups: number[][] = []
  let error: string | null = null
  if (total) {
    try {
      groups =
        mode === 'ranges'
          ? parseRanges(ranges || `1-${Math.ceil(total / 2)}, ${Math.ceil(total / 2) + 1}-${total}`, total)
          : chunkPages(total, mode === 'single' ? 1 : every)
    } catch (e) {
      error = (e as Error).message
    }
  }
  if (mode === 'ranges' && total < 2 && !ranges) groups = total ? [[0]] : []

  const split = () =>
    run(async (progress) => {
      progress(0.2, `Creating ${groups.length} files`)
      const parts = await splitPdf(pdfs.bytes[0], groups)
      const name = baseName(files[0])
      return {
        outputs: parts.map((b, i) => pdfOut(`${name}-pages-${describeGroup(groups[i]).replace('–', '-')}.pdf`, b)),
        summary: `Split into ${parts.length} ${parts.length === 1 ? 'file' : 'files'}`,
      }
    })

  if (pdfs.status === 'error') return <Notice>{pdfs.error}</Notice>

  return (
    <div className="panel">
      <div className="card card-stack">
        <Field label="Split by">
          <Segmented
            label="Split mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'ranges', label: 'Page ranges' },
              { value: 'every', label: 'Every N pages' },
              { value: 'single', label: 'Every page' },
            ]}
          />
        </Field>
        {mode === 'ranges' && (
          <Field label="Ranges" hint={total ? `Pages 1–${total}` : undefined}>
            <TextInput
              value={ranges}
              placeholder={total ? `e.g. 1-${Math.ceil(total / 2)}, ${Math.ceil(total / 2) + 1}-${total}` : ''}
              onChange={(e) => setRanges(e.target.value)}
              invalid={!!error}
              aria-label="Page ranges"
            />
          </Field>
        )}
        {mode === 'every' && (
          <Field label="Pages per file">
            <NumberInput label="Pages per file" value={every} onChange={setEvery} min={1} max={Math.max(1, total)} />
          </Field>
        )}
        {error ? (
          <Notice>{error}</Notice>
        ) : (
          groups.length > 0 && (
            <Notice tone="info">
              {groups.length} {groups.length === 1 ? 'file' : 'files'}: {groups.slice(0, 8).map((g) => `pages ${describeGroup(g)}`).join(', ')}
              {groups.length > 8 ? '…' : ''}
            </Notice>
          )
        )}
      </div>
      {pdfs.status === 'ready' && <PageGrid pdfs={pdfs} items={items} />}
      <RunBar label="Split PDF" onClick={split} disabled={!groups.length || !!error || pdfs.status !== 'ready'}>
        {total} pages
      </RunBar>
    </div>
  )
}
