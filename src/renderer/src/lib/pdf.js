import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDFDocument, degrees } from 'pdf-lib'

// pdf.js needs its worker. Vite gives us a hashed URL for the worker bundle.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Quickly check whether bytes are an openable PDF, before we commit them to
 * the editor. Returns { ok: true, pageCount } or { ok: false, reason }, where
 * reason is 'password' (encrypted, needs a password to open), 'invalid'
 * (corrupt / not a PDF) or 'unknown'. Never throws.
 */
export async function inspectPdf(bytes) {
  let doc
  try {
    doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise
    const pageCount = doc.numPages
    return { ok: true, pageCount }
  } catch (err) {
    const name = err?.name || ''
    if (name === 'PasswordException') return { ok: false, reason: 'password' }
    if (name === 'InvalidPDFException') return { ok: false, reason: 'invalid' }
    return { ok: false, reason: 'unknown', message: err?.message }
  } finally {
    if (doc) doc.destroy()
  }
}

/**
 * Render every page of a PDF (given as bytes) to a small thumbnail data URL.
 * Returns an array of { pageNumber, dataUrl, width, height }.
 *
 * pdf.js transfers the buffer it's handed, so we always pass a copy to keep the
 * caller's source-of-truth bytes intact.
 */
export async function renderThumbnails(bytes, { maxWidth = 150 } = {}) {
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise
  const pages = []
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const scale = maxWidth / base.width
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      await page.render({ canvasContext: ctx, viewport }).promise
      pages.push({
        pageNumber: n,
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height
      })
      page.cleanup()
    }
  } finally {
    doc.destroy()
  }
  return pages
}

/**
 * Render a single page at higher resolution for the main preview pane.
 * Returns a data URL.
 */
export async function renderPage(bytes, pageNumber, { maxWidth = 900 } = {}) {
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise
  try {
    const page = await doc.getPage(pageNumber)
    const base = page.getViewport({ scale: 1 })
    // Cap the scale so huge pages don't blow up memory; allow a little upscale
    // for small pages so the preview never looks tiny.
    const scale = Math.min(maxWidth / base.width, 2)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({ canvasContext: ctx, viewport }).promise
    return canvas.toDataURL('image/png')
  } finally {
    doc.destroy()
  }
}

/**
 * Remove the given page numbers (1-based) from the PDF and return new bytes.
 * Uses pdf-lib, which preserves the rest of the document faithfully.
 */
export async function deletePages(bytes, pageNumbers) {
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  // Remove from highest index down so earlier removals don't shift later ones.
  const sorted = [...new Set(pageNumbers)].sort((a, b) => b - a)
  for (const n of sorted) {
    pdfDoc.removePage(n - 1)
  }
  const out = await pdfDoc.save()
  return out // Uint8Array
}

/**
 * Get the displayed size (in CSS px at scale 1) of every page, accounting for
 * rotation. Used to reserve scroll space before a page is lazily rendered.
 */
export async function getPageSizes(bytes) {
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise
  const sizes = []
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const vp = page.getViewport({ scale: 1 })
      sizes.push({ pageNumber: n, width: vp.width, height: vp.height })
      page.cleanup()
    }
  } finally {
    doc.destroy()
  }
  return sizes
}

/**
 * Rotate the given pages (1-based) by `delta` degrees (e.g. +90 / -90),
 * relative to their current rotation. Returns new bytes.
 */
export async function rotatePages(bytes, pageNumbers, delta) {
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  for (const n of new Set(pageNumbers)) {
    const page = pdfDoc.getPage(n - 1)
    const current = page.getRotation().angle || 0
    // Normalise into [0, 360) so the value stays clean across many rotations.
    const next = (((current + delta) % 360) + 360) % 360
    page.setRotation(degrees(next))
  }
  return pdfDoc.save()
}

/**
 * Move the page at `fromIndex` to `toIndex` (both 0-based), using standard
 * array-move semantics: the page ends up at position `toIndex` in the result.
 * Removing then re-inserting the same page object keeps its content intact.
 */
export async function reorderPage(bytes, fromIndex, toIndex) {
  if (fromIndex === toIndex) return bytes
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const page = pdfDoc.getPage(fromIndex)
  pdfDoc.removePage(fromIndex)
  pdfDoc.insertPage(toIndex, page)
  return pdfDoc.save()
}

/**
 * Append every page of `addBytes` to the end of `baseBytes`. Returns new bytes.
 * copyPages carries each page's content, size and rotation into the base doc.
 */
export async function mergePdf(baseBytes, addBytes) {
  const base = await PDFDocument.load(baseBytes, { ignoreEncryption: true })
  const extra = await PDFDocument.load(addBytes, { ignoreEncryption: true })
  const copied = await base.copyPages(extra, extra.getPageIndices())
  copied.forEach((p) => base.addPage(p))
  return base.save()
}

/**
 * Build a brand-new PDF containing only the given pages (1-based), in page
 * order. Used to extract/split a selection out into its own file.
 */
export async function extractPages(bytes, pageNumbers) {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const indices = [...new Set(pageNumbers)].sort((a, b) => a - b).map((n) => n - 1)
  const copied = await out.copyPages(src, indices)
  copied.forEach((p) => out.addPage(p))
  return out.save()
}

/** Count pages without rendering — used for guard rails. */
export async function countPages(bytes) {
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  return pdfDoc.getPageCount()
}
