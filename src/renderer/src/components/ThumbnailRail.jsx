import { useState } from 'react'
import { Check, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Left rail: a scrollable column of page thumbnails.
 * - Checkbox selects pages (for rotate / delete).
 * - Clicking the body sets the active (previewed) page.
 * - Dragging a card reorders pages.
 */
export function ThumbnailRail({
  thumbs,
  activePage,
  selected,
  onToggleSelect,
  onSetActive,
  onReorder
}) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  const handleDrop = (toIndex) => {
    if (dragIndex !== null && dragIndex !== toIndex) onReorder(dragIndex, toIndex)
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pages
        </span>
        <span className="text-xs text-muted-foreground">{thumbs.length}</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {thumbs.map((t, index) => {
          const isSelected = selected.has(t.pageNumber)
          const isActive = activePage === t.pageNumber
          const isDragging = dragIndex === index
          const isDropTarget = overIndex === index && dragIndex !== null && dragIndex !== index
          return (
            <div key={t.pageNumber} className="flex flex-col items-center gap-1">
              <div
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => {
                  setDragIndex(null)
                  setOverIndex(null)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverIndex(index)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDrop(index)
                }}
                className={cn(
                  'group relative w-full cursor-pointer overflow-hidden rounded-md border bg-white transition-all duration-150',
                  isActive
                    ? 'border-accent ring-2 ring-accent/30'
                    : 'border-border hover:border-muted-foreground/40',
                  isDragging && 'opacity-40',
                  isDropTarget && 'ring-2 ring-accent'
                )}
                onClick={() => onSetActive(t.pageNumber)}
              >
                <img
                  src={t.dataUrl}
                  alt={`Page ${t.pageNumber}`}
                  className="w-full"
                  draggable={false}
                />

                {/* Selection checkbox, top-left. */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleSelect(t.pageNumber)
                  }}
                  aria-label={`${isSelected ? 'Deselect' : 'Select'} page ${t.pageNumber}`}
                  aria-pressed={isSelected}
                  className={cn(
                    'absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded border transition-colors',
                    isSelected
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-white/90 text-transparent group-hover:border-muted-foreground/60'
                  )}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </button>

                {/* Drag affordance, top-right (appears on hover). */}
                <div className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-white/90 p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  <GripVertical className="size-3.5" />
                </div>

                {isSelected && <div className="pointer-events-none absolute inset-0 bg-accent/10" />}
              </div>
              <span
                className={cn(
                  'text-xs tabular-nums',
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {t.pageNumber}
              </span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
