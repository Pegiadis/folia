import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// pdf.js worker is configured once in lib/pdf.js (same module instance).

export const TOOLS = ['select', 'highlight', 'text', 'rect', 'pen']

export const COLORS = ['#FACC15', '#DC2626', '#2563EB', '#16A34A', '#0F172A']

// Sizes are stored as fractions of the page so they're resolution-independent.
export const SIZES = {
  S: { fontSize: 0.018, thickness: 0.0025 },
  M: { fontSize: 0.026, thickness: 0.004 },
  L: { fontSize: 0.04, thickness: 0.007 }
}

let counter = 0
function nextId() {
  counter += 1
  return `a${counter}`
}

/**
 * All geometry is normalized to [0,1] in the page's *displayed* space
 * (top-left origin, y down), so it stays correct across zoom levels.
 */
export function createAnnotation({ page, type, color, size, geom }) {
  return { id: nextId(), page, type, color, ...SIZES[size], ...geom }
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

// --- Coordinate remapping for structural page edits -------------------------

/** Rotate a normalized point by ±90°. dir: +1 = clockwise, -1 = counter-cw. */
function rotatePoint({ x, y }, dir) {
  return dir > 0 ? { x: 1 - y, y: x } : { x: y, y: 1 - x }
}

function rotateGeom(a, dir) {
  if (a.type === 'pen') {
    return { ...a, points: a.points.map((p) => rotatePoint(p, dir)) }
  }
  if (a.type === 'text') {
    return { ...a, ...rotatePoint({ x: a.x, y: a.y }, dir) }
  }
  // highlight / rect: rotate both corners, then normalize to top-left + size.
  const c1 = rotatePoint({ x: a.x, y: a.y }, dir)
  const c2 = rotatePoint({ x: a.x + a.w, y: a.y + a.h }, dir)
  return {
    ...a,
    x: Math.min(c1.x, c2.x),
    y: Math.min(c1.y, c2.y),
    w: Math.abs(c2.x - c1.x),
    h: Math.abs(c2.y - c1.y)
  }
}

/** Keep annotation geometry aligned when pages are rotated. */
export function remapForRotate(annotations, pageNumbers, delta) {
  const pages = new Set(pageNumbers)
  const dir = delta > 0 ? 1 : -1
  return annotations.map((a) => (pages.has(a.page) ? rotateGeom(a, dir) : a))
}

/** Drop annotations on deleted pages; shift the survivors' page numbers. */
export function remapForDelete(annotations, removedPageNumbers) {
  const removed = new Set(removedPageNumbers)
  return annotations
    .filter((a) => !removed.has(a.page))
    .map((a) => {
      const shift = [...removed].filter((p) => p < a.page).length
      return shift ? { ...a, page: a.page - shift } : a
    })
}

/** Re-key annotations when a page moves from one index to another (0-based). */
export function remapForReorder(annotations, fromIndex, toIndex, pageCount) {
  const order = Array.from({ length: pageCount }, (_, i) => i + 1)
  const [moved] = order.splice(fromIndex, 1)
  order.splice(toIndex, 0, moved)
  const oldToNew = new Map()
  order.forEach((oldPage, i) => oldToNew.set(oldPage, i + 1))
  return annotations.map((a) => ({ ...a, page: oldToNew.get(a.page) ?? a.page }))
}

// --- Burning annotations into the PDF ---------------------------------------

/**
 * Draw every annotation into the PDF and return new bytes. pdf.js gives us a
 * viewport per page so display coordinates map back to PDF user space exactly,
 * including page rotation. pdf-lib then renders the shapes/text.
 */
export async function burnAnnotations(bytes, annotations) {
  if (!annotations || annotations.length === 0) return bytes

  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const jsDoc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise

  try {
    const byPage = new Map()
    for (const a of annotations) {
      if (!byPage.has(a.page)) byPage.set(a.page, [])
      byPage.get(a.page).push(a)
    }

    for (const [pageNum, anns] of byPage) {
      const libPage = pdfDoc.getPage(pageNum - 1)
      const jsPage = await jsDoc.getPage(pageNum)
      const vp = jsPage.getViewport({ scale: 1 })
      const { width: Wu, height: Hu } = libPage.getSize()

      // Normalized display point -> PDF user-space point.
      const toPdf = (nx, ny) => {
        const [px, py] = vp.convertToPdfPoint(nx * vp.width, ny * vp.height)
        return { x: px, y: py }
      }

      for (const a of anns) {
        const color = hexToRgb(a.color)

        if (a.type === 'highlight' || a.type === 'rect') {
          const p1 = toPdf(a.x, a.y)
          const p2 = toPdf(a.x + a.w, a.y + a.h)
          const x = Math.min(p1.x, p2.x)
          const y = Math.min(p1.y, p2.y)
          const width = Math.abs(p2.x - p1.x)
          const height = Math.abs(p2.y - p1.y)
          if (a.type === 'highlight') {
            libPage.drawRectangle({ x, y, width, height, color, opacity: 0.35 })
          } else {
            libPage.drawRectangle({
              x,
              y,
              width,
              height,
              borderColor: color,
              borderWidth: (a.thickness ?? 0.004) * Wu
            })
          }
        } else if (a.type === 'pen') {
          const pts = a.points.map((pt) => toPdf(pt.x, pt.y))
          const thickness = (a.thickness ?? 0.004) * Wu
          for (let i = 1; i < pts.length; i++) {
            libPage.drawLine({ start: pts[i - 1], end: pts[i], thickness, color })
          }
        } else if (a.type === 'text' && a.text) {
          const anchor = toPdf(a.x, a.y)
          const size = (a.fontSize ?? 0.026) * Hu
          // anchor is the top-left of the text box; baseline sits one line below.
          libPage.drawText(a.text, { x: anchor.x, y: anchor.y - size, size, font, color })
        } else if (a.type === 'image' && a.dataUrl) {
          const base64 = a.dataUrl.includes(',') ? a.dataUrl.split(',')[1] : a.dataUrl
          const png = await pdfDoc.embedPng(base64)
          const p1 = toPdf(a.x, a.y)
          const p2 = toPdf(a.x + a.w, a.y + a.h)
          libPage.drawImage(png, {
            x: Math.min(p1.x, p2.x),
            y: Math.min(p1.y, p2.y),
            width: Math.abs(p2.x - p1.x),
            height: Math.abs(p2.y - p1.y)
          })
        }
      }
    }
  } finally {
    jsDoc.destroy()
  }

  return pdfDoc.save()
}
