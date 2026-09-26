import { useState } from 'react'
import { FileList } from '../../process/FileList'
import { Field, Notice, RunBar, Segmented } from '../../process/controls'
import { baseName, formatBytes, pdfOut, readBytes, type Output, type PanelProps } from '../../process/types'
import { compressPdf, type CompressLevel } from '../../engine/raster'

const HINTS: Record<CompressLevel, string> = {
  low: 'Best quality. Shrinks oversized photos gently; text stays selectable.',
  recommended: 'Good quality, much smaller. Text stays selectable.',
  extreme: 'Smallest file. Pages become images, so text can no longer be selected or searched.',
}

export default function Compress({ files, setFiles, addFiles, run }: PanelProps) {
  const [level, setLevel] = useState<CompressLevel>('recommended')

  const go = () =>
    run(async (progress) => {
      const outputs: Output[] = []
      let before = 0
      let after = 0
      let unchanged = 0
      for (const [i, f] of files.entries()) {
        const bytes = await readBytes(f)
        const r = await compressPdf(bytes, level, (p, label) =>
          progress((i + p) / files.length, files.length > 1 ? `${f.name}: ${label ?? ''}` : label),
        )
        before += bytes.length
        after += r.bytes.length
        if (r.unchanged) unchanged++
        outputs.push(pdfOut(`${baseName(f)}-compressed.pdf`, r.bytes))
      }
      const saved = before ? Math.round((1 - after / before) * 100) : 0
      return {
        outputs,
        summary: saved > 0 ? `Saved ${saved}% · ${formatBytes(before)} → ${formatBytes(after)}` : 'Already well optimized',
        note:
          unchanged === files.length
            ? 'We couldn’t make this smaller without losing quality, so the original is kept. Try Extreme for scanned documents.'
            : unchanged
              ? `${unchanged} ${unchanged === 1 ? 'file was' : 'files were'} already optimized and kept as is.`
              : undefined,
      }
    })

  return (
    <div className="panel">
      <FileList files={files} onChange={setFiles} onAdd={addFiles} />
      <div className="card card-stack">
        <Field label="Compression">
          <Segmented
            label="Compression level"
            value={level}
            onChange={setLevel}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'recommended', label: 'Recommended' },
              { value: 'extreme', label: 'Extreme' },
            ]}
          />
        </Field>
        <Notice tone="info">{HINTS[level]}</Notice>
      </div>
      <RunBar label="Compress" onClick={go} disabled={!files.length}>
        {files.length} {files.length === 1 ? 'file' : 'files'} · {formatBytes(files.reduce((n, f) => n + f.size, 0))}
      </RunBar>
    </div>
  )
}
