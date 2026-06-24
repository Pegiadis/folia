import { MousePointer2, Highlighter, Type, Square, Pen, Eraser, PenTool } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COLORS } from '@/lib/annotations'

const TOOL_ITEMS = [
  { id: 'select', label: 'Select', Icon: MousePointer2 },
  { id: 'highlight', label: 'Highlight', Icon: Highlighter },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'rect', label: 'Rectangle', Icon: Square },
  { id: 'pen', label: 'Pen', Icon: Pen },
  { id: 'eraser', label: 'Eraser', Icon: Eraser }
]

const SIZE_ITEMS = [
  { id: 'S', dot: 'size-1.5' },
  { id: 'M', dot: 'size-2.5' },
  { id: 'L', dot: 'size-3.5' }
]

/** Slim vertical markup toolbar between the thumbnail rail and the page. */
export function AnnotationToolbar({
  tool,
  color,
  size,
  onToolChange,
  onColorChange,
  onSizeChange,
  onSign
}) {
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-3">
      {TOOL_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          title={label}
          aria-label={label}
          aria-pressed={tool === id}
          onClick={() => onToolChange(id)}
          className={cn(
            'flex size-10 items-center justify-center rounded-md transition-colors',
            tool === id
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Icon className="size-5" />
        </button>
      ))}

      <div className="my-1 h-px w-7 bg-border" />

      {/* Colors */}
      <div className="flex flex-col items-center gap-1.5 py-1">
        {COLORS.map((c) => (
          <button
            key={c}
            title={c}
            aria-label={`Color ${c}`}
            onClick={() => onColorChange(c)}
            className={cn(
              'size-6 rounded-full border transition-transform hover:scale-110',
              color === c ? 'ring-2 ring-offset-2 ring-offset-card ring-foreground' : 'border-border'
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="my-1 h-px w-7 bg-border" />

      {/* Signature: create (and place) */}
      <button
        title="Signature"
        aria-label="Signature"
        aria-pressed={tool === 'signature'}
        onClick={onSign}
        className={cn(
          'flex size-10 items-center justify-center rounded-md transition-colors',
          tool === 'signature'
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <PenTool className="size-5" />
      </button>

      <div className="my-1 h-px w-7 bg-border" />

      {/* Stroke / text size */}
      <div className="flex flex-col items-center gap-1">
        {SIZE_ITEMS.map(({ id, dot }) => (
          <button
            key={id}
            title={`Size ${id}`}
            aria-label={`Size ${id}`}
            aria-pressed={size === id}
            onClick={() => onSizeChange(id)}
            className={cn(
              'flex size-8 items-center justify-center rounded-md transition-colors',
              size === id
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <span className={cn('rounded-full bg-current', dot)} />
          </button>
        ))}
      </div>
    </div>
  )
}
