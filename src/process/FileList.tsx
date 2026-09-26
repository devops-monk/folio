import { useEffect, useMemo, type CSSProperties } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FileText, GripVertical, Plus, X } from 'lucide-react'
import { formatBytes } from './types'

// Stable ids for File objects across reorders.
const ids = new WeakMap<File, string>()
function fileId(f: File) {
  let id = ids.get(f)
  if (!id) {
    id = crypto.randomUUID()
    ids.set(f, id)
  }
  return id
}

interface Props {
  files: File[]
  onChange: (files: File[]) => void
  onAdd?: () => void
  /** Extra info per file, e.g. "12 pages". */
  meta?: (f: File) => string | undefined
  addLabel?: string
}

/** Reorderable list of chosen files (drag handle, keyboard and touch). */
export function FileList({ files, onChange, onAdd, meta, addLabel = 'Add more files' }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const items = files.map(fileId)

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onChange(arrayMove(files, items.indexOf(String(active.id)), items.indexOf(String(over.id))))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ul className="file-list" aria-label="Files">
          {files.map((f) => (
            <FileRow
              key={fileId(f)}
              id={fileId(f)}
              file={f}
              meta={meta?.(f)}
              sortable={files.length > 1}
              onRemove={() => onChange(files.filter((x) => x !== f))}
            />
          ))}
          {onAdd && (
            <li>
              <button type="button" className="file-add" onClick={onAdd}>
                <Plus size={18} /> {addLabel}
              </button>
            </li>
          )}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function FileRow({ id, file, meta, sortable, onRemove }: { id: string; file: File; meta?: string; sortable: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition }
  const isImage = file.type.startsWith('image/')
  const thumb = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [file, isImage])
  useEffect(() => () => void (thumb && URL.revokeObjectURL(thumb)), [thumb])

  return (
    <li ref={setNodeRef} style={style} className="file-row" data-dragging={isDragging || undefined}>
      {sortable && (
        <button type="button" className="drag-handle" aria-label={`Reorder ${file.name}`} {...attributes} {...listeners}>
          <GripVertical size={18} />
        </button>
      )}
      {thumb ? (
        <img className="file-thumb" src={thumb} alt="" />
      ) : (
        <span className="file-thumb">
          <FileText size={18} />
        </span>
      )}
      <span className="file-meta">
        <strong>{file.name}</strong>
        <span>
          {formatBytes(file.size)}
          {meta ? ` · ${meta}` : ''}
        </span>
      </span>
      <button type="button" className="icon-button" onClick={onRemove} aria-label={`Remove ${file.name}`}>
        <X size={17} />
      </button>
    </li>
  )
}
