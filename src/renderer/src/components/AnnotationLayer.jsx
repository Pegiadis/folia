import { useEffect, useRef, useState } from 'react'
import { SIZES } from '@/lib/annotations'

// --- geometry helpers (all in normalized [0,1] page space) ------------------

function normalizeRect(r) {
  return {
    x: Math.min(r.x, r.x + r.w),
    y: Math.min(r.y, r.y + r.h),
    w: Math.abs(r.w),
    h: Math.abs(r.h)
  }
}

function bbox(a) {
  if (a.type === 'pen') {
    const xs = a.points.map((p) => p.x)
    const ys = a.points.map((p) => p.y)
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
  }
  if (a.type === 'text') {
    const fs = a.fontSize ?? 0.026
    return { x: a.x, y: a.y, w: Math.max(0.08, (a.text?.length ?? 4) * fs * 0.5), h: fs * 1.3 }
  }
  return { x: a.x, y: a.y, w: a.w, h: a.h } // rect / highlight / image
}

function hit(a, p) {
  const b = bbox(a)
  const pad = 0.01
  return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad
}

function moveGeom(a, dx, dy) {
  if (a.type === 'pen') return { ...a, points: a.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
  return { ...a, x: a.x + dx, y: a.y + dy }
}

/**
 * Transparent SVG overlay sized to the displayed page. Captures pointer input
 * for the active tool and renders both committed annotations and live drafts.
 */
export function AnnotationLayer({
  pageNumber,
  annotations,
  tool,
  color,
  size,
  signature,
  width,
  height,
  selectedId,
  onSelect,
  onCommit,
  onUpdate,
  onErase,
  onDeleteSelected
}) {
  const svgRef = useRef(null)
  const [draft, setDraft] = useState(null)
  const [drag, setDrag] = useState(null)
  const [erasing, setErasing] = useState(false)
  const [editing, setEditing] = useState(null) // { x, y, value }

  const pageAnns = annotations.filter((a) => a.page === pageNumber)
  const drawing = tool !== 'select'

  // Delete / Backspace removes the selected annotation (unless typing text).
  useEffect(() => {
    const onKey = (e) => {
      if (editing) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        onDeleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, selectedId, onDeleteSelected])

  const pointFromEvent = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    }
  }

  const handlePointerDown = (e) => {
    if (editing) return
    const p = pointFromEvent(e)
    e.currentTarget.setPointerCapture(e.pointerId)

    if (tool === 'select') {
      const found = [...pageAnns].reverse().find((a) => hit(a, p))
      onSelect(found ? found.id : null)
      if (found) setDrag({ id: found.id, start: p, orig: found })
      return
    }
    if (tool === 'eraser') {
      setErasing(true)
      const found = [...pageAnns].reverse().find((a) => hit(a, p))
      if (found) onErase(found.id)
      return
    }
    if (tool === 'highlight' || tool === 'rect') {
      setDraft({ type: tool, x: p.x, y: p.y, w: 0, h: 0 })
    } else if (tool === 'pen') {
      setDraft({ type: 'pen', points: [p] })
    } else if (tool === 'text') {
      setEditing({ x: p.x, y: p.y, value: '' })
    } else if (tool === 'signature' && signature) {
      // Drop the signature centered on the click, preserving its aspect ratio.
      const w = 0.28
      const h = w * (width / height) * signature.ratio
      onCommit({
        type: 'image',
        page: pageNumber,
        geom: { x: p.x - w / 2, y: p.y - h / 2, w, h, dataUrl: signature.dataUrl }
      })
    }
  }

  const handlePointerMove = (e) => {
    if (drag) {
      const p = pointFromEvent(e)
      onUpdate(drag.id, moveGeom(drag.orig, p.x - drag.start.x, p.y - drag.start.y))
      return
    }
    if (erasing) {
      const p = pointFromEvent(e)
      const found = [...pageAnns].reverse().find((a) => hit(a, p))
      if (found) onErase(found.id)
      return
    }
    if (!draft) return
    const p = pointFromEvent(e)
    if (draft.type === 'pen') {
      setDraft({ ...draft, points: [...draft.points, p] })
    } else {
      setDraft({ ...draft, w: p.x - draft.x, h: p.y - draft.y })
    }
  }

  const handlePointerUp = () => {
    if (drag) {
      setDrag(null)
      return
    }
    if (erasing) {
      setErasing(false)
      return
    }
    if (!draft) return
    if (draft.type === 'pen') {
      if (draft.points.length > 1) onCommit({ type: 'pen', page: pageNumber, geom: { points: draft.points } })
    } else {
      const r = normalizeRect(draft)
      if (r.w > 0.005 && r.h > 0.005) {
        onCommit({ type: draft.type, page: pageNumber, geom: { x: r.x, y: r.y, w: r.w, h: r.h } })
      }
    }
    setDraft(null)
  }

  const commitText = () => {
    if (editing && editing.value.trim()) {
      onCommit({ type: 'text', page: pageNumber, geom: { x: editing.x, y: editing.y, text: editing.value.trim() } })
    }
    setEditing(null)
  }

  const W = width
  const H = height
  const px = (frac, axis) => frac * (axis === 'x' ? W : H)
  const cursor =
    tool === 'select'
      ? drag
        ? 'grabbing'
        : 'default'
      : tool === 'text'
        ? 'text'
        : tool === 'signature'
          ? 'copy'
          : tool === 'eraser'
            ? 'cell'
            : 'crosshair'

  const renderAnn = (a, key) => {
    const stroke = (a.thickness ?? 0.004) * W
    const isSel = a.id === selectedId
    const common = isSel ? { 'data-sel': true } : {}
    if (a.type === 'highlight') {
      return <rect key={key} x={px(a.x, 'x')} y={px(a.y, 'y')} width={px(a.w, 'x')} height={px(a.h, 'y')} fill={a.color} opacity={0.35} {...common} />
    }
    if (a.type === 'rect') {
      return <rect key={key} x={px(a.x, 'x')} y={px(a.y, 'y')} width={px(a.w, 'x')} height={px(a.h, 'y')} fill="none" stroke={a.color} strokeWidth={stroke} {...common} />
    }
    if (a.type === 'pen') {
      return <polyline key={key} points={a.points.map((p) => `${px(p.x, 'x')},${px(p.y, 'y')}`).join(' ')} fill="none" stroke={a.color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...common} />
    }
    if (a.type === 'text') {
      const fs = (a.fontSize ?? 0.026) * H
      return (
        <text key={key} x={px(a.x, 'x')} y={px(a.y, 'y')} dominantBaseline="hanging" fontSize={fs} fontFamily="Inter, sans-serif" fill={a.color} {...common}>
          {a.text}
        </text>
      )
    }
    if (a.type === 'image') {
      return <image key={key} href={a.dataUrl} x={px(a.x, 'x')} y={px(a.y, 'y')} width={px(a.w, 'x')} height={px(a.h, 'y')} preserveAspectRatio="none" {...common} />
    }
    return null
  }

  const draftStroke = SIZES[size].thickness * W

  return (
    <div className="absolute inset-0" style={{ width: W, height: H }}>
      <svg
        ref={svgRef}
        width={W}
        height={H}
        className="absolute inset-0"
        style={{ cursor, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {pageAnns.map((a) => renderAnn(a, a.id))}

        {/* selection outline */}
        {selectedId &&
          (() => {
            const a = pageAnns.find((x) => x.id === selectedId)
            if (!a) return null
            const b = bbox(a)
            return (
              <rect
                x={px(b.x, 'x') - 4}
                y={px(b.y, 'y') - 4}
                width={px(b.w, 'x') + 8}
                height={px(b.h, 'y') + 8}
                fill="none"
                stroke="#2563EB"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            )
          })()}

        {/* live draft */}
        {draft && draft.type === 'pen' && (
          <polyline points={draft.points.map((p) => `${px(p.x, 'x')},${px(p.y, 'y')}`).join(' ')} fill="none" stroke={color} strokeWidth={draftStroke} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {draft && draft.type === 'highlight' && (() => { const r = normalizeRect(draft); return <rect x={px(r.x, 'x')} y={px(r.y, 'y')} width={px(r.w, 'x')} height={px(r.h, 'y')} fill={color} opacity={0.35} /> })()}
        {draft && draft.type === 'rect' && (() => { const r = normalizeRect(draft); return <rect x={px(r.x, 'x')} y={px(r.y, 'y')} width={px(r.w, 'x')} height={px(r.h, 'y')} fill="none" stroke={color} strokeWidth={draftStroke} /> })()}
      </svg>

      {editing && (
        <textarea
          autoFocus
          value={editing.value}
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commitText()
            } else if (e.key === 'Escape') {
              setEditing(null)
            }
          }}
          placeholder="Type…"
          className="absolute resize-none rounded border border-accent bg-white/95 px-1 py-0.5 leading-tight shadow-sm outline-none"
          style={{
            left: px(editing.x, 'x'),
            top: px(editing.y, 'y'),
            color,
            fontSize: SIZES[size].fontSize * H,
            minWidth: 80
          }}
        />
      )}
    </div>
  )
}
