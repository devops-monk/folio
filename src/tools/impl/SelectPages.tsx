import { useMemo, useState } from 'react'
import { Field, Notice, RunBar, Segmented, TextInput } from '../../process/controls'
import { baseName, pdfOut, type PanelProps } from '../../process/types'
import { keepPages, parseRanges, removePages, splitPdf } from '../../engine/pages'
import { PageGrid } from '../../process/PageGrid'
import { initialItems, useLoadedPdfs } from '../../process/pdfs'

/** Shared panel for Remove Pages and Extract Pages: pick pages by clicking or by typing ranges. */
export default function SelectPages({ tool, files, run }: PanelProps) {
  const removing = tool.id === 'remove-pages'
  const pdfs = useLoadedPdfs(files)
  const items = useMemo(() => initialItems(pdfs.sizes), [pdfs.sizes])
  const total = items.length
  // Clicked pages; typed ranges take over while the text box has content.
  const [clicked, setClicked] = useState<Set<number>>(new Set())
  const [typed, setTyped] = useState('')
  const [separate, setSeparate] = useState<'one' | 'separate'>('one')

  // Derived during render so ranges typed before the pages finish loading still apply.
  let picked = clicked
  let typedError: string | null = null
  if (typed.trim() && total) {
    try {
      picked = new Set(parseRanges(typed, total).flat())
    } catch (e) {
      typedError = (e as Error).message
      picked = new Set()
    }
  }

  const keyToPage = new Map(items.map((i) => [i.key, i.page]))
  const selectedKeys = new Set(items.filter((i) => picked.has(i.page)).map((i) => i.key))
  const sorted = [...picked].sort((a, b) => a - b)

  const toggle = (key: string) => {
    const p = keyToPage.get(key)!
    const next = new Set(picked)
    if (next.has(p)) next.delete(p)
    else next.add(p)
    setClicked(next)
    setTyped('')
  }

  const go = () =>
    run(async (progress) => {
      progress(0.3, removing ? 'Removing pages' : 'Extracting pages')
      const name = baseName(files[0])
      if (removing) {
        const out = await removePages(pdfs.bytes[0], sorted)
        return { outputs: [pdfOut(`${name}-trimmed.pdf`, out)], summary: `Removed ${sorted.length} ${sorted.length === 1 ? 'page' : 'pages'}` }
      }
      if (separate === 'separate') {
        const parts = await splitPdf(pdfs.bytes[0], sorted.map((p) => [p]))
        return { outputs: parts.map((b, i) => pdfOut(`${name}-page-${sorted[i] + 1}.pdf`, b)), summary: `Extracted ${parts.length} pages` }
      }
      const out = await keepPages(pdfs.bytes[0], sorted)
      return { outputs: [pdfOut(`${name}-extract.pdf`, out)], summary: `Extracted ${sorted.length} ${sorted.length === 1 ? 'page' : 'pages'}` }
    })

  if (pdfs.status === 'error') return <Notice>{pdfs.error}</Notice>

  const invalid = !sorted.length || (removing && sorted.length >= total)

  return (
    <div className="panel">
      <div className="card card-stack">
        <Field label={removing ? 'Pages to remove' : 'Pages to extract'} hint="Click pages below, or type ranges">
          <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="e.g. 2, 5-7" invalid={!!typedError} aria-label="Page ranges" />
        </Field>
        {typedError && <Notice>{typedError}</Notice>}
        {!removing && (
          <Field label="Save as">
            <Segmented
              label="Output"
              value={separate}
              onChange={setSeparate}
              options={[
                { value: 'one', label: 'One PDF' },
                { value: 'separate', label: 'A PDF per page' },
              ]}
            />
          </Field>
        )}
        {removing && sorted.length >= total && total > 0 && <Notice>You can’t remove every page.</Notice>}
      </div>
      {pdfs.status === 'ready' && (
        <PageGrid pdfs={pdfs} items={items} mode={removing ? 'mark' : 'select'} selected={selectedKeys} onToggle={toggle} />
      )}
      <RunBar label={removing ? 'Remove pages' : 'Extract pages'} onClick={go} disabled={invalid || pdfs.status !== 'ready'}>
        {sorted.length} of {total} selected
      </RunBar>
    </div>
  )
}
