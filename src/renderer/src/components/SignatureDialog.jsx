import { useEffect, useRef, useState } from 'react'
import { X, Eraser } from 'lucide-react'
import { Button } from './ui/button'

const CANVAS_W = 520
const CANVAS_H = 180

/**
 * Create a signature by drawing it with the mouse or typing it in a script
 * font. Produces a transparent PNG plus its aspect ratio for placement.
 */
export function SignatureDialog({ open, onClose, onCreate }) {
  const [mode, setMode] = useState('draw')
  const [typed, setTyped] = useState('')
  const [hasInk, setHasInk] = useState(false)
  const canvasRef = useRef(null)
  const drawing = useRef(false)

  // Reset when (re)opened.
  useEffect(() => {
    if (!open) return
    setMode('draw')
    setTyped('')
    setHasInk(false)
    const c = canvasRef.current
    if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height)
  }, [open])

  if (!open) return null

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * CANVAS_W, y: ((e.clientY - r.top) / r.height) * CANVAS_H }
  }
  const start = (e) => {
    drawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0F172A'
  }
  const move = (e) => {
    if (!drawing.current) return
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasInk(true)
  }
  const end = () => {
    drawing.current = false
  }
  const clear = () => {
    const c = canvasRef.current
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setHasInk(false)
  }

  const create = () => {
    if (mode === 'draw') {
      if (!hasInk) return
      onCreate({ dataUrl: canvasRef.current.toDataURL('image/png'), ratio: CANVAS_H / CANVAS_W })
    } else {
      const text = typed.trim()
      if (!text) return
      const c = document.createElement('canvas')
      c.width = CANVAS_W
      c.height = CANVAS_H
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#0F172A'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = "64px 'Segoe Script', 'Brush Script MT', cursive"
      ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2)
      onCreate({ dataUrl: c.toDataURL('image/png'), ratio: CANVAS_H / CANVAS_W })
    }
    onClose()
  }

  const canCreate = mode === 'draw' ? hasInk : typed.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
      <div className="w-[560px] rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Add your signature</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="mb-3 inline-flex rounded-md border border-border p-0.5">
          {['draw', 'type'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={
                'rounded px-4 py-1.5 text-sm font-medium capitalize transition-colors ' +
                (mode === m ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')
              }
            >
              {m}
            </button>
          ))}
        </div>

        {mode === 'draw' ? (
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full rounded-md border border-dashed border-border bg-white"
              style={{ touchAction: 'none', cursor: 'crosshair' }}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
            />
            <button
              onClick={clear}
              className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Eraser className="size-3.5" />
              Clear
            </button>
          </div>
        ) : (
          <div className="flex h-[180px] flex-col gap-2">
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type your name"
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div
              className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border bg-white text-4xl text-foreground"
              style={{ fontFamily: "'Segoe Script', 'Brush Script MT', cursive" }}
            >
              {typed || <span className="text-base text-muted-foreground">Preview</span>}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create} disabled={!canCreate}>
            Use signature
          </Button>
        </div>
      </div>
    </div>
  )
}
