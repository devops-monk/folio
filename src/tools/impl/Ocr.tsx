import { useState } from 'react'
import { Field, Notice, RunBar, Switch } from '../../process/controls'
import { baseName, pdfOut, readBytes, type PanelProps } from '../../process/types'
import { ocrPdf } from '../../engine/ocr'

export default function Ocr({ files, run }: PanelProps) {
  const [skipText, setSkipText] = useState(true)

  const go = () =>
    run(async (progress) => {
      const { bytes, pagesDone } = await ocrPdf(await readBytes(files[0]), skipText, progress)
      return {
        outputs: [pdfOut(`${baseName(files[0])}-searchable.pdf`, bytes)],
        summary: pagesDone ? `Recognized text on ${pagesDone} ${pagesDone === 1 ? 'page' : 'pages'}` : 'No scanned pages found',
        note: pagesDone
          ? 'You can now search and select the text. The pages look exactly the same.'
          : 'Every page already had selectable text. Turn off “Skip pages that already have text” to process them anyway.',
      }
    })

  return (
    <div className="panel">
      <div className="card card-stack">
        <Field label="Language">
          <p style={{ fontSize: 15 }}>English</p>
        </Field>
        <Switch checked={skipText} onChange={setSkipText} label="Skip pages that already have text" />
        <Notice tone="info">
          The first run downloads the text-recognition model (about 3 MB) from this site. It’s cached for next time, and
          your document never leaves your device.
        </Notice>
      </div>
      <RunBar label="Make searchable" onClick={go} disabled={!files.length} />
    </div>
  )
}
