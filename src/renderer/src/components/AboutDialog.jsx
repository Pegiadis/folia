import { useEffect, useState } from 'react'
import { X, Lock } from 'lucide-react'
import { Button } from './ui/button'

/**
 * About / info modal: brand, version, the privacy promise, and credits.
 * The version is read from the main process so it always matches the build.
 */
export function AboutDialog({ open, onClose }) {
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (!open) return
    window.api.getVersion?.().then((v) => setVersion(v || ''))
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-lg border border-border bg-card p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="-mt-2 flex flex-col items-center gap-3">
          <svg className="size-16 rounded-2xl" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" rx="56" fill="#2563EB" />
            <path d="M78 56 h70 l30 30 v114 a8 8 0 0 1 -8 8 H78 a8 8 0 0 1 -8 -8 V64 a8 8 0 0 1 8 -8 z" fill="#FFFFFF" />
            <path d="M148 56 l30 30 h-26 a4 4 0 0 1 -4 -4 z" fill="#DBEAFE" />
            <rect x="92" y="120" width="72" height="9" rx="4.5" fill="#CBD5E1" />
            <rect x="92" y="140" width="72" height="9" rx="4.5" fill="#CBD5E1" />
            <rect x="92" y="160" width="56" height="14" rx="3" fill="#FACC15" />
          </svg>

          <div>
            <h2 className="text-xl font-bold text-foreground">Folia</h2>
            <p className="text-sm text-muted-foreground">
              {version ? `Version ${version}` : 'PDF editor'}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            A fast, private PDF editor. Delete, reorder, rotate, merge, annotate, fill forms and sign.
          </p>

          <div className="my-1 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs font-medium text-foreground">
            <Lock className="size-4 text-accent" />
            Your files never leave your computer.
          </div>

          <div className="text-xs text-muted-foreground">
            <p>© 2026 Ioannis Pegiadis · MIT License</p>
            <p>Built with Electron, React &amp; pdf-lib</p>
          </div>

          <Button variant="secondary" size="sm" onClick={onClose} className="mt-1">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
