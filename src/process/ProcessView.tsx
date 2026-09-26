import { Suspense, useRef, useState, type ComponentType } from 'react'
import { ArrowLeft, CircleCheck, Download, FileText, FileImage, LoaderCircle, RotateCcw } from 'lucide-react'
import type { ToolDef } from '../tools/registry'
import { formatBytes, type Job, type PanelProps, type Result } from './types'
import { Notice } from './controls'
import './ProcessView.css'

interface Props {
  tool: ToolDef
  files: File[]
  setFiles: (files: File[]) => void
  Panel: ComponentType<PanelProps>
  onReset: () => void
}

type Phase = { kind: 'edit' } | { kind: 'running'; fraction: number; label?: string } | { kind: 'done'; result: Result }

function saveBlob(name: string, bytes: Uint8Array | Blob, type: string) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Hosts a tool's options panel, runs its job with progress, then shows the downloads. */
export function ProcessView({ tool, files, setFiles, Panel, onReset }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' })
  const [error, setError] = useState<string | null>(null)
  const addInput = useRef<HTMLInputElement>(null)

  const run = (job: Job) => {
    setError(null)
    setPhase({ kind: 'running', fraction: 0 })
    // Let the progress UI paint before heavy synchronous work starts.
    requestAnimationFrame(async () => {
      try {
        const result = await job((fraction, label) => setPhase({ kind: 'running', fraction, label }))
        setPhase({ kind: 'done', result })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch (err) {
        console.error(err)
        setError(err instanceof Error && err.message ? err.message : 'Something went wrong.')
        setPhase({ kind: 'edit' })
      }
    })
  }

  if (phase.kind === 'done') {
    return <ResultView result={phase.result} onBack={() => setPhase({ kind: 'edit' })} onReset={onReset} />
  }

  return (
    <div className="process">
      {error && <Notice>{error}</Notice>}
      <Suspense
        fallback={
          <div className="process-loading">
            <LoaderCircle className="spin" size={24} />
          </div>
        }
      >
        <Panel tool={tool} files={files} setFiles={setFiles} addFiles={() => addInput.current?.click()} run={run} />
      </Suspense>

      <input
        ref={addInput}
        type="file"
        accept={tool.accept}
        multiple
        className="visually-hidden"
        tabIndex={-1}
        onChange={(e) => {
          const more = Array.from(e.target.files ?? [])
          if (more.length) setFiles([...files, ...more])
          e.target.value = ''
        }}
      />

      {phase.kind === 'running' && (
        <div className="progress-overlay" role="status" aria-live="polite">
          <div className="progress-card">
            <LoaderCircle className="spin" size={28} />
            <p className="progress-label">{phase.label ?? 'Working…'}</p>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.round(phase.fraction * 100)}%` }} />
            </div>
            <p className="progress-hint">Processing on your device</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultView({ result, onBack, onReset }: { result: Result; onBack: () => void; onReset: () => void }) {
  const [zipping, setZipping] = useState(false)
  const { outputs } = result
  const total = outputs.reduce((n, o) => n + o.bytes.length, 0)

  const downloadAll = async () => {
    setZipping(true)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      const used = new Set<string>()
      for (const o of outputs) {
        let name = o.name
        for (let i = 2; used.has(name); i++) name = o.name.replace(/(\.[^.]+)?$/, ` (${i})$1`)
        used.add(name)
        zip.file(name, o.bytes)
      }
      saveBlob('folio-files.zip', await zip.generateAsync({ type: 'blob' }), 'application/zip')
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="result">
      <div className="result-hero">
        <CircleCheck className="result-check" size={52} strokeWidth={1.8} aria-hidden />
        <h2>{result.summary ?? (outputs.length === 1 ? 'Your file is ready' : `${outputs.length} files are ready`)}</h2>
        {result.note && <p>{result.note}</p>}
      </div>

      <div className="result-actions">
        {outputs.length === 1 ? (
          <button className="button-primary" onClick={() => saveBlob(outputs[0].name, outputs[0].bytes, outputs[0].type)}>
            <Download size={18} strokeWidth={2.4} /> Download
          </button>
        ) : (
          <button className="button-primary" onClick={downloadAll} disabled={zipping}>
            {zipping ? <LoaderCircle className="spin" size={18} /> : <Download size={18} strokeWidth={2.4} />}
            Download all (.zip · {formatBytes(total)})
          </button>
        )}
      </div>

      <ul className="result-list">
        {outputs.map((o, i) => (
          <li key={`${o.name}-${i}`}>
            {o.type.startsWith('image/') ? <FileImage size={20} aria-hidden /> : <FileText size={20} aria-hidden />}
            <span className="result-name">{o.name}</span>
            <span className="result-size">{formatBytes(o.bytes.length)}</span>
            <button className="icon-button" onClick={() => saveBlob(o.name, o.bytes, o.type)} aria-label={`Download ${o.name}`}>
              <Download size={17} />
            </button>
          </li>
        ))}
      </ul>

      <div className="result-footer">
        <button className="button-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Change options
        </button>
        <button className="button-secondary" onClick={onReset}>
          <RotateCcw size={16} /> Start over
        </button>
      </div>
    </div>
  )
}
