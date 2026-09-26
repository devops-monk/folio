import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, FileText, ShieldCheck } from 'lucide-react'
import { getCategory, getTool, type ToolDef } from '../tools/registry'
import { DropZone } from '../components/DropZone'
import { ProcessView } from '../process/ProcessView'
import { panels } from '../tools/panels'
import { NotFound } from './NotFound'
import './ToolPage.css'

// Tools whose panels show page grids or previews get a wider layout.
const WIDE = new Set([
  'split-pdf',
  'organize-pdf',
  'remove-pages',
  'extract-pages',
  'rotate-pdf',
  'watermark-pdf',
  'page-numbers',
  'crop-pdf',
  'compare-pdf',
])

// Loaded on demand so pdf.js and pdf-lib stay out of the home page bundle.
const Workspace = lazy(() => import('../workspace/Workspace'))

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export function ToolPage() {
  const tool = getTool(useParams().toolId)
  if (!tool) return <NotFound />
  // Keyed so switching tools starts with fresh state.
  return <ToolView key={tool.id} tool={tool} />
}

function ToolView({ tool }: { tool: ToolDef }) {
  const [files, setFiles] = useState<File[]>([])

  useEffect(() => {
    document.title = `${tool.name} — Folio`
    return () => {
      document.title = 'Folio — Private PDF Tools'
    }
  }, [tool])

  const Icon = tool.icon
  const tint = getCategory(tool.category).tint

  if (tool.ready && tool.workspace && files[0]) {
    return (
      <Suspense fallback={null}>
        <Workspace file={files[0]} tool={tool} onClose={() => setFiles([])} />
      </Suspense>
    )
  }

  return (
    <div
      className="tool-page container"
      data-wide={files.length > 0 && WIDE.has(tool.id) ? true : undefined}
      style={{ '--tint': tint } as CSSProperties}
    >
      <Link to="/" className="back-link">
        <ChevronLeft size={20} strokeWidth={2.4} aria-hidden />
        All tools
      </Link>

      <header className="tool-header">
        <span className="tool-header-icon" aria-hidden>
          <Icon size={30} strokeWidth={1.9} />
        </span>
        <h1>{tool.name}</h1>
        <p>{tool.description}</p>
      </header>

      {files.length === 0 ? (
        <DropZone accept={tool.accept} multiple={tool.multiple} onFiles={setFiles} />
      ) : panels[tool.id] ? (
        <ProcessView tool={tool} files={files} setFiles={setFiles} Panel={panels[tool.id]} onReset={() => setFiles([])} />
      ) : (
        <section className="file-card" aria-label="Selected files">
          <ul>
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <FileText size={20} aria-hidden />
                <span className="file-name">{f.name}</span>
                <span className="file-size">{formatSize(f.size)}</span>
              </li>
            ))}
          </ul>
          <button className="button-secondary" onClick={() => setFiles([])}>
            Choose different files
          </button>
        </section>
      )}

      <p className="privacy-note">
        <ShieldCheck size={16} aria-hidden />
        Processed on your device. Files are never uploaded.
      </p>
    </div>
  )
}
