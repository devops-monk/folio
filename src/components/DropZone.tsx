import { useEffect, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import './DropZone.css'

interface Props {
  accept: string
  multiple: boolean
  onFiles: (files: File[]) => void
}

function matchesAccept(file: File, accept: string) {
  const rules = accept.split(',').map((s) => s.trim().toLowerCase())
  const name = file.name.toLowerCase()
  return rules.some((r) => (r.startsWith('.') ? name.endsWith(r) : file.type === r))
}

/** Large drop target. Also accepts files dropped anywhere on the window and pasted files. */
export function DropZone({ accept, multiple, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const depth = useRef(0)

  const take = (list: FileList | File[] | null | undefined) => {
    const all = Array.from(list ?? [])
    if (!all.length) return
    const ok = all.filter((f) => matchesAccept(f, accept))
    if (!ok.length) {
      setError('That file type isn’t supported by this tool.')
      return
    }
    setError(null)
    onFiles(multiple ? ok : ok.slice(0, 1))
  }

  // Window-level drag & paste so users can drop anywhere.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files')
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current++
      setDragging(true)
    }
    const leave = () => {
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      take(e.dataTransfer?.files)
    }
    const paste = (e: ClipboardEvent) => take(e.clipboardData?.files)

    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    window.addEventListener('paste', paste)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
      window.removeEventListener('paste', paste)
    }
  })

  const kind = accept.includes('pdf') ? 'PDF' : 'image'

  return (
    <div className="dropzone" data-dragging={dragging || undefined}>
      <span className="dropzone-icon" aria-hidden>
        <Upload size={26} strokeWidth={2} />
      </span>
      <button className="button-primary" onClick={() => inputRef.current?.click()}>
        Choose {multiple ? `${kind} files` : `a ${kind}`}
      </button>
      <p className="dropzone-hint">or drop {multiple ? 'them' : 'it'} anywhere on this page</p>
      {error && (
        <p className="dropzone-error" role="alert">
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="visually-hidden"
        tabIndex={-1}
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
