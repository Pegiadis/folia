import { useCallback, useEffect, useState } from 'react'
import { Toolbar } from './components/Toolbar'
import { ThumbnailRail } from './components/ThumbnailRail'
import { AnnotationToolbar } from './components/AnnotationToolbar'
import { DocumentView } from './components/DocumentView'
import { ActionBar } from './components/ActionBar'
import { SignatureDialog } from './components/SignatureDialog'
import { AboutDialog } from './components/AboutDialog'
import { ToastProvider, useToast } from './components/ui/toast'
import {
  inspectPdf,
  renderThumbnails,
  getPageSizes,
  deletePages,
  rotatePages,
  reorderPage,
  mergePdf,
  extractPages
} from './lib/pdf'
import {
  COLORS,
  createAnnotation,
  burnAnnotations,
  remapForDelete,
  remapForReorder,
  remapForRotate
} from './lib/annotations'
import { getFormFields, fillForm } from './lib/forms'

function Editor() {
  const { show } = useToast()

  // currentBytes is the single source of truth for what's on screen.
  const [fileName, setFileName] = useState(null)
  const [originalBytes, setOriginalBytes] = useState(null)
  const [currentBytes, setCurrentBytes] = useState(null)
  const [history, setHistory] = useState([])

  const [thumbs, setThumbs] = useState([])
  const [pageSizes, setPageSizes] = useState([])
  const [activePage, setActivePage] = useState(1)
  const [scrollRequest, setScrollRequest] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState(false)

  // Annotation state: in-memory marks, burned into the PDF on save/extract.
  const [annotations, setAnnotations] = useState([])
  const [tool, setTool] = useState('select')
  const [annColor, setAnnColor] = useState(COLORS[0])
  const [annSize, setAnnSize] = useState('M')
  const [selectedAnnId, setSelectedAnnId] = useState(null)

  // Form fields (positions from pdf.js) + the values the user enters.
  const [formFields, setFormFields] = useState([])
  const [formValues, setFormValues] = useState({})

  // Signature: a reusable PNG the user draws/types, placed as image annotations.
  const [signature, setSignature] = useState(null)
  const [sigOpen, setSigOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  const hasDoc = !!currentBytes
  const canUndo = history.length > 0
  // Anything that Reset would discard: page edits, annotations, or form input.
  const hasEdits =
    hasDoc &&
    (canUndo ||
      originalBytes !== currentBytes ||
      annotations.length > 0 ||
      Object.keys(formValues).length > 0)

  const applyEdit = useCallback(
    (newBytes) => {
      setHistory((h) => [...h, currentBytes])
      setCurrentBytes(newBytes)
    },
    [currentBytes]
  )

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      setCurrentBytes(h[h.length - 1])
      return h.slice(0, -1)
    })
  }, [])

  // Thumbnails, page sizes and form fields are all derived from the document.
  useEffect(() => {
    if (!currentBytes) {
      setThumbs([])
      setPageSizes([])
      setFormFields([])
      return
    }
    let cancelled = false
    renderThumbnails(currentBytes)
      .then((pages) => !cancelled && setThumbs(pages))
      .catch((err) => show({ title: 'Could not render PDF', description: String(err.message) }))
    getPageSizes(currentBytes)
      .then((sizes) => !cancelled && setPageSizes(sizes))
      .catch(() => {})
    getFormFields(currentBytes)
      .then((fields) => !cancelled && setFormFields(fields))
      .catch(() => !cancelled && setFormFields([]))
    return () => {
      cancelled = true
    }
  }, [currentBytes, show])

  // Load a { name, data } document into a clean editing state. Shared by the
  // in-app Open button and files opened from outside (file association).
  // Validates the file first so a bad PDF shows a clear message instead of a
  // broken, half-loaded view.
  const loadDocument = useCallback(
    async (result) => {
      if (!result) return
      const check = await inspectPdf(result.data)
      if (!check.ok) {
        const messages = {
          password: 'This PDF is password-protected. Folia can’t open protected PDFs yet.',
          invalid: 'Couldn’t read this file — it may be corrupt or not a valid PDF.',
          unknown: check.message || 'Couldn’t open this PDF.'
        }
        show({ title: 'Can’t open this PDF', description: messages[check.reason] })
        return
      }
      setHistory([])
      setFileName(result.name)
      setOriginalBytes(result.data)
      setCurrentBytes(result.data)
      setSelected(new Set())
      setActivePage(1)
      setAnnotations([])
      setSelectedAnnId(null)
      setFormValues({})
      setSignature(null)
      setTool('select')
    },
    [show]
  )

  const handleOpen = useCallback(async () => {
    setBusy(true)
    try {
      await loadDocument(await window.api.openPdf())
    } catch (err) {
      show({ title: 'Failed to open file', description: String(err.message) })
    } finally {
      setBusy(false)
    }
  }, [loadDocument, show])

  // PDFs opened from outside the app ("Open with Folia", double-click).
  useEffect(() => {
    return window.api.onOpenFile?.(loadDocument)
  }, [loadDocument])

  // Auto-update: when a new version finishes downloading, offer a restart.
  useEffect(() => {
    return window.api.onUpdateStatus?.((status) => {
      if (status.state === 'ready') {
        show({
          title: 'Update ready',
          description: `Folia ${status.version || ''} will install on restart.`,
          duration: 0,
          action: { label: 'Restart', onClick: () => window.api.installUpdate?.() }
        })
      }
    })
  }, [show])

  const toggleSelect = useCallback((pageNumber) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(pageNumber) ? next.delete(pageNumber) : next.add(pageNumber)
      return next
    })
  }, [])

  const goToPage = useCallback((pageNumber) => {
    setActivePage(pageNumber)
    setScrollRequest({ page: pageNumber, key: pageNumber + Math.random() })
  }, [])

  // --- Tool / signature selection --------------------------------------------
  const handleToolChange = useCallback(
    (id) => {
      if (id === 'signature' && !signature) {
        setSigOpen(true)
        return
      }
      setTool(id)
    },
    [signature]
  )

  const handleSignatureCreate = useCallback((sig) => {
    setSignature(sig)
    setTool('signature')
  }, [])

  // Sign button: create the first time, enter placement when one exists,
  // reopen the dialog to replace while already in placement mode.
  const handleSign = useCallback(() => {
    if (!signature || tool === 'signature') setSigOpen(true)
    else setTool('signature')
  }, [signature, tool])

  // --- Annotation editing -----------------------------------------------------
  const addAnnotation = useCallback(
    ({ type, page, geom }) => {
      const ann = createAnnotation({ page: page ?? activePage, type, color: annColor, size: annSize, geom })
      setAnnotations((prev) => [...prev, ann])
      setSelectedAnnId(ann.id)
    },
    [activePage, annColor, annSize]
  )

  const updateAnnotation = useCallback((id, geom) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...geom } : a)))
  }, [])

  const deleteSelectedAnnotation = useCallback(() => {
    if (!selectedAnnId) return
    setAnnotations((prev) => prev.filter((a) => a.id !== selectedAnnId))
    setSelectedAnnId(null)
  }, [selectedAnnId])

  const eraseAnnotation = useCallback((id) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
    setSelectedAnnId((cur) => (cur === id ? null : cur))
  }, [])

  const onFieldChange = useCallback((name, value) => {
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  // --- Page operations --------------------------------------------------------
  const handleRotate = useCallback(
    async (delta) => {
      if (selected.size === 0) return
      const pages = [...selected]
      try {
        applyEdit(await rotatePages(currentBytes, pages, delta))
        setAnnotations((prev) => remapForRotate(prev, pages, delta))
      } catch (err) {
        show({ title: 'Rotate failed', description: String(err.message) })
      }
    },
    [selected, currentBytes, applyEdit, show]
  )

  const handleReorder = useCallback(
    async (fromIndex, toIndex) => {
      const count = thumbs.length
      try {
        applyEdit(await reorderPage(currentBytes, fromIndex, toIndex))
        setAnnotations((prev) => remapForReorder(prev, fromIndex, toIndex, count))
      } catch (err) {
        show({ title: 'Reorder failed', description: String(err.message) })
      }
    },
    [currentBytes, applyEdit, thumbs.length, show]
  )

  const handleMerge = useCallback(async () => {
    setBusy(true)
    try {
      const result = await window.api.openPdf()
      if (!result) return
      applyEdit(await mergePdf(currentBytes, result.data))
      show({ title: 'Merged', description: `Added pages from ${result.name}` })
    } catch (err) {
      show({ title: 'Merge failed', description: String(err.message) })
    } finally {
      setBusy(false)
    }
  }, [currentBytes, applyEdit, show])

  const handleExtract = useCallback(async () => {
    if (selected.size === 0) return
    setBusy(true)
    try {
      const pages = [...selected].sort((a, b) => a - b)
      let bytes = await fillForm(currentBytes, formValues)
      bytes = await burnAnnotations(bytes, annotations)
      const newBytes = await extractPages(bytes, pages)
      const base = fileName ? fileName.replace(/\.pdf$/i, '') : 'extract'
      const result = await window.api.savePdf(newBytes, `${base}-pages.pdf`)
      if (result) show({ title: 'Extracted', description: `${pages.length} page(s) → ${result.name}` })
    } catch (err) {
      show({ title: 'Extract failed', description: String(err.message) })
    } finally {
      setBusy(false)
    }
  }, [selected, currentBytes, formValues, annotations, fileName, show])

  const handleDelete = useCallback(async () => {
    if (selected.size === 0) return
    const toRemove = [...selected]
    try {
      applyEdit(await deletePages(currentBytes, toRemove))
      setSelected(new Set())
      setAnnotations((prev) => remapForDelete(prev, toRemove))
      show({
        title: `Deleted ${toRemove.length} page${toRemove.length === 1 ? '' : 's'}`,
        action: { label: 'Undo', onClick: undo }
      })
    } catch (err) {
      show({ title: 'Delete failed', description: String(err.message) })
    }
  }, [selected, currentBytes, applyEdit, undo, show])

  const handleReset = useCallback(() => {
    setHistory([])
    setCurrentBytes(originalBytes)
    setSelected(new Set())
    setActivePage(1)
    setAnnotations([])
    setSelectedAnnId(null)
    setFormValues({})
  }, [originalBytes])

  const handleSave = useCallback(async () => {
    if (!currentBytes) return
    setBusy(true)
    try {
      const suggested = fileName ? fileName.replace(/\.pdf$/i, '-edited.pdf') : 'edited.pdf'
      let bytes = await fillForm(currentBytes, formValues)
      bytes = await burnAnnotations(bytes, annotations)
      const result = await window.api.savePdf(bytes, suggested)
      if (result) show({ title: 'Saved', description: result.name })
    } catch (err) {
      show({ title: 'Save failed', description: String(err.message) })
    } finally {
      setBusy(false)
    }
  }, [currentBytes, fileName, formValues, annotations, show])

  const annotationBundle = {
    annotations,
    tool,
    color: annColor,
    size: annSize,
    signature,
    selectedId: selectedAnnId,
    onSelect: setSelectedAnnId,
    onCommit: addAnnotation,
    onUpdate: updateAnnotation,
    onErase: eraseAnnotation,
    onDeleteSelected: deleteSelectedAnnotation
  }

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        fileName={fileName}
        hasDoc={hasDoc}
        busy={busy}
        onOpen={handleOpen}
        onMerge={handleMerge}
        onSave={handleSave}
        onAbout={() => setAboutOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        {hasDoc && (
          <>
            <ThumbnailRail
              thumbs={thumbs}
              activePage={activePage}
              selected={selected}
              onToggleSelect={toggleSelect}
              onSetActive={goToPage}
              onReorder={handleReorder}
            />
            <AnnotationToolbar
              tool={tool}
              color={annColor}
              size={annSize}
              onToolChange={handleToolChange}
              onColorChange={setAnnColor}
              onSizeChange={setAnnSize}
              onSign={handleSign}
            />
          </>
        )}
        <DocumentView
          hasDoc={hasDoc}
          onOpen={handleOpen}
          currentBytes={currentBytes}
          pageSizes={pageSizes}
          activePage={activePage}
          onActivePageChange={setActivePage}
          scrollRequest={scrollRequest}
          annotation={annotationBundle}
          form={{ fields: formFields, values: formValues, onChange: onFieldChange }}
        />
      </div>
      {hasDoc && (
        <ActionBar
          selectedCount={selected.size}
          pageCount={thumbs.length}
          canUndo={canUndo}
          dirty={hasEdits}
          busy={busy}
          onRotateLeft={() => handleRotate(-90)}
          onRotateRight={() => handleRotate(90)}
          onExtract={handleExtract}
          onDelete={handleDelete}
          onUndo={undo}
          onReset={handleReset}
        />
      )}
      <SignatureDialog open={sigOpen} onClose={() => setSigOpen(false)} onCreate={handleSignatureCreate} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Editor />
    </ToastProvider>
  )
}
