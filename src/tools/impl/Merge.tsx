import { FileList } from '../../process/FileList'
import { usePageCounts } from '../../process/usePageCounts'
import { Notice, RunBar } from '../../process/controls'
import { baseName, pdfOut, readBytes, type PanelProps } from '../../process/types'
import { mergePdfs } from '../../engine/pages'

export default function Merge({ files, setFiles, addFiles, run }: PanelProps) {
  const counts = usePageCounts(files)
  const total = files.reduce((n, f) => n + (counts.get(f) ?? 0), 0)

  const merge = () =>
    run(async (progress) => {
      progress(0.1, 'Reading files')
      const bytes = await Promise.all(files.map(readBytes))
      progress(0.4, 'Combining pages')
      const out = await mergePdfs(bytes)
      return {
        outputs: [pdfOut(`${baseName(files[0])}-merged.pdf`, out)],
        summary: `Merged ${files.length} PDFs`,
        note: `${total} pages in one file, in the order you chose.`,
      }
    })

  return (
    <div className="panel">
      <FileList files={files} onChange={setFiles} onAdd={addFiles} meta={(f) => (counts.has(f) ? `${counts.get(f)} pages` : undefined)} />
      {files.length < 2 && <Notice tone="info">Add at least one more PDF to merge. Drag the handles to change the order.</Notice>}
      <RunBar label="Merge PDFs" onClick={merge} disabled={files.length < 2}>
        {files.length} files{total ? ` · ${total} pages` : ''}
      </RunBar>
    </div>
  )
}
