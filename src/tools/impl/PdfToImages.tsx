import { useState } from 'react'
import { Field, RunBar, Segmented } from '../../process/controls'
import { baseName, readBytes, type PanelProps } from '../../process/types'
import { pdfToImages } from '../../engine/raster'

export default function PdfToImages({ files, run }: PanelProps) {
  const [format, setFormat] = useState<'jpg' | 'png'>('jpg')
  const [dpi, setDpi] = useState<'72' | '150' | '300'>('150')

  const go = () =>
    run(async (progress) => {
      const outputs = await pdfToImages(await readBytes(files[0]), baseName(files[0]), { format, dpi: Number(dpi) }, progress)
      return { outputs, summary: `${outputs.length} ${outputs.length === 1 ? 'image' : 'images'} ready` }
    })

  return (
    <div className="panel">
      <div className="card card-stack">
        <Field label="Format">
          <Segmented
            label="Format"
            value={format}
            onChange={setFormat}
            options={[
              { value: 'jpg', label: 'JPG (smaller)' },
              { value: 'png', label: 'PNG (lossless)' },
            ]}
          />
        </Field>
        <Field label="Quality">
          <Segmented
            label="Resolution"
            value={dpi}
            onChange={setDpi}
            options={[
              { value: '72', label: 'Screen · 72 dpi' },
              { value: '150', label: 'Standard · 150 dpi' },
              { value: '300', label: 'Print · 300 dpi' },
            ]}
          />
        </Field>
      </div>
      <RunBar label="Convert to images" onClick={go} disabled={!files.length} />
    </div>
  )
}
