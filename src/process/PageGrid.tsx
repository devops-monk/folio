import type { CSSProperties } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, Copy, RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import { PageCanvas } from '../workspace/PageCanvas'
import type { LoadedPdfs, PageItem } from './pdfs'

export type { LoadedPdfs, PageItem }

const FILE_COLORS = ['var(--blue)', 'var(--orange)', 'var(--green)', 'var(--purple)', 'var(--pink)', 'var(--teal)']
const BOX = 120

interface Props {
  pdfs: LoadedPdfs
  items: PageItem[]
  /** Enables drag-to-reorder. */
  onReorder?: (items: PageItem[]) => void
  /** 'select' shows checkmarks; 'mark' crosses pages out (for removal). */
  mode?: 'select' | 'mark' | 'none'
  selected?: Set<string>
  onToggle?: (key: string) => void
  onRotate?: (key: string, delta: number) => void
  onDelete?: (key: string) => void
  onDuplicate?: (key: string) => void
  colorByFile?: boolean
}

export function PageGrid({ pdfs, items, onReorder, mode = 'none', selected, onToggle, onRotate, onDelete, onDuplicate, colorByFile }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !onReorder) return
    const keys = items.map((i) => i.key)
    onReorder(arrayMove(items, keys.indexOf(String(active.id)), keys.indexOf(String(over.id))))
  }

  const grid = (
    <div className="page-grid" role="list" aria-label="Pages">
      {items.map((it, idx) => (
        <PageTile
          key={it.key}
          item={it}
          index={idx}
          pdfs={pdfs}
          sortable={!!onReorder}
          mode={mode}
          selected={selected?.has(it.key) ?? false}
          onToggle={onToggle}
          onRotate={onRotate}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          color={colorByFile ? FILE_COLORS[it.file % FILE_COLORS.length] : undefined}
        />
      ))}
    </div>
  )

  if (!onReorder) return grid
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.key)} strategy={rectSortingStrategy}>
        {grid}
      </SortableContext>
    </DndContext>
  )
}

function PageTile({
  item,
  index,
  pdfs,
  sortable,
  mode,
  selected,
  onToggle,
  onRotate,
  onDelete,
  onDuplicate,
  color,
}: {
  item: PageItem
  index: number
  pdfs: LoadedPdfs
  sortable: boolean
  mode: 'select' | 'mark' | 'none'
  selected: boolean
  onToggle?: (key: string) => void
  onRotate?: (key: string, delta: number) => void
  onDelete?: (key: string) => void
  onDuplicate?: (key: string) => void
  color?: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key, disabled: !sortable })
  const size = pdfs.sizes[item.file][item.page]
  const k = BOX / Math.max(size.w, size.h)
  const bw = size.w * k
  const bh = size.h * k
  const quarter = ((item.rotate % 360) + 360) % 180 === 90
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="page-tile"
      role="listitem"
      data-dragging={isDragging || undefined}
      data-selected={(mode === 'select' && selected) || undefined}
      data-marked={(mode === 'mark' && selected) || undefined}
    >
      <button
        type="button"
        className="page-thumb"
        aria-pressed={mode !== 'none' ? selected : undefined}
        aria-label={`Page ${item.page + 1}${pdfs.docs.length > 1 ? ` of file ${item.file + 1}` : ''}`}
        onClick={() => mode !== 'none' && onToggle?.(item.key)}
        {...(sortable ? { ...attributes, ...listeners } : {})}
      >
        <span className="page-paper" style={{ width: quarter ? bh : bw, height: quarter ? bw : bh }}>
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: bw,
              height: bh,
              transform: `translate(-50%, -50%) rotate(${item.rotate}deg)`,
              transition: 'transform 0.35s var(--spring)',
            }}
          >
            <PageCanvas pdf={pdfs.docs[item.file]} index={item.page} scale={k} rootMargin="400px" />
          </span>
        </span>
        {mode === 'select' && (
          <span className="page-check" aria-hidden>
            {selected && <Check size={14} strokeWidth={3} />}
          </span>
        )}
      </button>
      {(onRotate || onDelete || onDuplicate) && (
        <div className="page-actions">
          {onRotate && (
            <>
              <button type="button" className="page-action-extra" onClick={() => onRotate(item.key, -90)} aria-label={`Rotate page ${index + 1} left`}>
                <RotateCcw size={14} />
              </button>
              <button type="button" onClick={() => onRotate(item.key, 90)} aria-label={`Rotate page ${index + 1} right`}>
                <RotateCw size={14} />
              </button>
            </>
          )}
          {onDuplicate && (
            <button type="button" className="page-action-extra" onClick={() => onDuplicate(item.key)} aria-label={`Duplicate page ${index + 1}`}>
              <Copy size={14} />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={() => onDelete(item.key)} aria-label={`Delete page ${index + 1}`}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
      <span className="page-label">
        {color && <span className="file-dot" style={{ background: color }} aria-hidden />}
        {sortable ? index + 1 : item.page + 1}
      </span>
    </div>
  )
}
