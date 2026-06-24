import { useEffect, useRef, useState, useCallback } from 'react'
import { FileUp, Lock } from 'lucide-react'
import { Button } from './ui/button'
import { AnnotationLayer } from './AnnotationLayer'
import { FormFieldLayer } from './FormFieldLayer'
import { renderPage } from '@/lib/pdf'

const TARGET_W = 820 // on-screen page width in CSS px

/**
 * Continuous, vertically scrollable view of every page. Pages are lazily
 * rendered as they approach the viewport (space is reserved up front from
 * pageSizes to avoid layout shift), and the active page follows the scroll.
 */
export function DocumentView({
  hasDoc,
  onOpen,
  currentBytes,
  pageSizes,
  activePage,
  onActivePageChange,
  scrollRequest,
  annotation,
  form
}) {
  const scrollRef = useRef(null)
  const pageEls = useRef([])
  const ratios = useRef(new Map())
  const inFlight = useRef(new Set())
  const lastActive = useRef(activePage)
  const [rendered, setRendered] = useState({})

  // New document (or edit) → drop cached page images.
  useEffect(() => {
    setRendered({})
    inFlight.current = new Set()
    ratios.current = new Map()
  }, [currentBytes])

  const renderOne = useCallback(
    async (n) => {
      if (inFlight.current.has(n)) return
      inFlight.current.add(n)
      try {
        const url = await renderPage(currentBytes, n, { maxWidth: Math.round(TARGET_W * 1.5) })
        setRendered((prev) => ({ ...prev, [n]: url }))
      } catch {
        inFlight.current.delete(n)
      }
    },
    [currentBytes]
  )

  // Lazy render + active-page tracking via a single IntersectionObserver.
  useEffect(() => {
    const root = scrollRef.current
    if (!root || pageSizes.length === 0) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number(e.target.dataset.page)
          ratios.current.set(n, e.isIntersecting ? e.intersectionRatio : 0)
          if (e.isIntersecting) renderOne(n)
        }
        let best = lastActive.current
        let bestRatio = -1
        for (const [n, r] of ratios.current) {
          if (r > bestRatio) {
            bestRatio = r
            best = n
          }
        }
        if (best !== lastActive.current) {
          lastActive.current = best
          onActivePageChange(best)
        }
      },
      { root, rootMargin: '400px 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    )
    pageEls.current.slice(0, pageSizes.length).forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [pageSizes, renderOne, onActivePageChange])

  // Scroll to a page when requested (e.g. thumbnail click).
  useEffect(() => {
    if (!scrollRequest) return
    const el = pageEls.current[scrollRequest.page - 1]
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [scrollRequest])

  if (!hasDoc) {
    return (
      <main className="flex flex-1 items-center justify-center bg-background">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <FileUp className="size-8" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">Open a PDF to get started</h2>
            <p className="text-sm text-muted-foreground">
              Scroll through your document, then edit, annotate, fill forms, and sign.
            </p>
          </div>
          <Button onClick={onOpen} size="lg">
            <FileUp />
            Open PDF
          </Button>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" />
            100% private — your files never leave your computer.
          </p>
        </div>
      </main>
    )
  }

  const interactive = annotation.tool === 'select'

  return (
    <main ref={scrollRef} className="flex-1 overflow-auto bg-background">
      <div className="flex flex-col items-center gap-6 py-8">
        {pageSizes.map((p, i) => {
          const w = TARGET_W
          const h = TARGET_W * (p.height / p.width)
          const url = rendered[p.pageNumber]
          return (
            <div
              key={p.pageNumber}
              data-page={p.pageNumber}
              ref={(el) => (pageEls.current[i] = el)}
              className="relative shrink-0 scroll-mt-6 rounded-md border border-border bg-white shadow-lg"
              style={{ width: w, height: h }}
            >
              {url ? (
                <>
                  <img src={url} alt={`Page ${p.pageNumber}`} className="block h-full w-full" draggable={false} />
                  <AnnotationLayer pageNumber={p.pageNumber} width={w} height={h} {...annotation} />
                  <FormFieldLayer
                    fields={form.fields.filter((f) => f.page === p.pageNumber)}
                    values={form.values}
                    onChange={form.onChange}
                    interactive={interactive}
                    width={w}
                    height={h}
                  />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  Page {p.pageNumber}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
