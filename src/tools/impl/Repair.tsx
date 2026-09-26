import { Notice, RunBar } from '../../process/controls'
import { baseName, pdfOut, readBytes, type PanelProps } from '../../process/types'
import { repairPdf } from '../../engine/raster'

export default function Repair({ files, run }: PanelProps) {
  const go = () =>
    run(async (progress) => {
      const { bytes, method } = await repairPdf(await readBytes(files[0]), progress)
      return {
        outputs: [pdfOut(`${baseName(files[0])}-repaired.pdf`, bytes)],
        summary: 'Repaired',
        note:
          method === 'rebuilt'
            ? 'The document structure was rebuilt. Text, links and quality are preserved.'
            : 'The file was badly damaged, so the readable pages were recovered as images.',
      }
    })

  return (
    <div className="panel">
      <div className="card">
        <Notice tone="info">
          Folio rebuilds the file’s internal structure. If that isn’t enough, it recovers every page it can still read.
        </Notice>
      </div>
      <RunBar label="Repair PDF" onClick={go} disabled={!files.length} />
    </div>
  )
}
