import { useState } from 'react'
import { Field, Notice, RunBar, Slider, Switch } from '../../process/controls'
import { baseName, pdfOut, type PanelProps } from '../../process/types'
import { cropPages } from '../../engine/stamp'
import { useLoadedPdfs } from '../../process/pdfs'
import { FirstPagePreview } from '../../process/Preview'

type Side = 'top' | 'right' | 'bottom' | 'left'
const SIDES: Side[] = ['top', 'right', 'bottom', 'left']

export default function Crop({ files, run }: PanelProps) {
  const pdfs = useLoadedPdfs(files)
  const [m, setM] = useState<Record<Side, number>>({ top: 0.06, right: 0.08, bottom: 0.06, left: 0.08 })
  const [linked, setLinked] = useState(false)

  const set = (side: Side, v: number) => setM((prev) => (linked ? { top: v, right: v, bottom: v, left: v } : { ...prev, [side]: v }))

  const go = () =>
    run(async (progress) => {
      progress(0.3, 'Cropping pages')
      const out = await cropPages(pdfs.bytes[0], m)
      return { outputs: [pdfOut(`${baseName(files[0])}-cropped.pdf`, out)], summary: 'Pages cropped', note: 'Every page was cropped by the same margins.' }
    })

  if (pdfs.status === 'error') return <Notice>{pdfs.error}</Notice>

  return (
    <div className="panel">
      <div className="two-col">
        <div className="card card-stack">
          <Switch checked={linked} onChange={setLinked} label="Same margin on all sides" />
          {(linked ? (['top'] as Side[]) : SIDES).map((side) => (
            <Field key={side} label={linked ? 'Margin' : side[0].toUpperCase() + side.slice(1)}>
              <Slider label={`${side} margin`} value={m[side]} onChange={(v) => set(side, v)} min={0} max={0.4} step={0.005} format={(v) => `${Math.round(v * 100)}%`} />
            </Field>
          ))}
        </div>
        <FirstPagePreview pdfs={pdfs}>
          {() => (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: `${m.top * 100}%`,
                right: `${m.right * 100}%`,
                bottom: `${m.bottom * 100}%`,
                left: `${m.left * 100}%`,
                boxShadow: '0 0 0 9999px rgba(0,0,0,.45)',
                outline: '2px solid var(--accent)',
                transition: 'all .15s var(--ease)',
              }}
            />
          )}
        </FirstPagePreview>
      </div>
      <RunBar label="Crop PDF" onClick={go} disabled={pdfs.status !== 'ready' || m.top + m.bottom >= 0.9 || m.left + m.right >= 0.9} />
    </div>
  )
}
