import { useEffect, useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { AnnotationLayer } from './AnnotationLayer'

/** Center stage: the active page rendered large, with the annotation overlay. */
export function PreviewPane({ previewUrl, loading, hasDoc, activePage, onOpen, annotation }) {
  const imgRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Track the page image's on-screen pixel size so the overlay lines up exactly.
  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    const measure = () => setSize({ w: img.clientWidth, h: img.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(img)
    return () => ro.disconnect()
  }, [previewUrl])

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
              Select pages from the side rail, then edit, annotate, and save a new copy.
            </p>
          </div>
          <Button onClick={onOpen} size="lg">
            <FileUp />
            Open PDF
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-auto bg-background p-8">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {previewUrl && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <img
              ref={imgRef}
              src={previewUrl}
              alt={`Page ${activePage}`}
              className="max-h-full rounded-md border border-border bg-white shadow-lg"
              draggable={false}
              onLoad={(e) => setSize({ w: e.target.clientWidth, h: e.target.clientHeight })}
            />
            {annotation && size.w > 0 && (
              <AnnotationLayer
                pageNumber={activePage}
                width={size.w}
                height={size.h}
                {...annotation}
              />
            )}
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">Page {activePage}</span>
        </div>
      )}
    </main>
  )
}
