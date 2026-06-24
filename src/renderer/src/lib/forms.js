import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'

/**
 * Discover interactive form fields and where they sit on each page. pdf.js
 * reports widget annotations with their type, value and rectangle; we normalize
 * the rect into [0,1] display space so the overlay can position inputs exactly.
 */
export async function getFormFields(bytes) {
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise
  const fields = []
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const vp = page.getViewport({ scale: 1 })
      const annots = await page.getAnnotations()
      for (const a of annots) {
        if (a.subtype !== 'Widget' || !a.fieldName || a.pushButton) continue
        const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect)
        const x = Math.min(x1, x2)
        const y = Math.min(y1, y2)
        const w = Math.abs(x2 - x1)
        const h = Math.abs(y2 - y1)
        fields.push({
          id: a.id,
          name: a.fieldName,
          fieldType: a.fieldType, // 'Tx' | 'Btn' | 'Ch'
          checkBox: !!a.checkBox,
          radioButton: !!a.radioButton,
          exportValue: a.exportValue,
          fieldValue: a.fieldValue,
          options: a.options || null, // [{ exportValue, displayValue }]
          combo: !!a.combo,
          multiline: !!a.multiLine,
          readOnly: !!a.readOnly,
          page: n,
          rect: { x: x / vp.width, y: y / vp.height, w: w / vp.width, h: h / vp.height }
        })
      }
      page.cleanup()
    }
  } finally {
    doc.destroy()
  }
  return fields
}

/**
 * Write the collected values back into the PDF's form fields. Leaves the form
 * interactive (no flatten) so it can still be edited later.
 */
export async function fillForm(bytes, values) {
  if (!values || Object.keys(values).length === 0) return bytes
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = doc.getForm()
  for (const [name, val] of Object.entries(values)) {
    let field
    try {
      field = form.getField(name)
    } catch {
      continue
    }
    const kind = field.constructor.name
    try {
      if (kind === 'PDFTextField') field.setText(val == null ? '' : String(val))
      else if (kind === 'PDFCheckBox') (val ? field.check() : field.uncheck())
      else if (kind === 'PDFDropdown' && val) field.select(String(val))
      else if (kind === 'PDFRadioGroup' && val) field.select(String(val))
      else if (kind === 'PDFOptionList' && val) field.select(String(val))
    } catch {
      // Ignore values that a field rejects (e.g. option no longer present).
    }
  }
  return doc.save()
}
