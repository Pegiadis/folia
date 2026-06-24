import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

const ToastContext = React.createContext(null)

/** Minimal single-slot toast. Supports an optional action button (e.g. Undo). */
export function ToastProvider({ children }) {
  const [toast, setToast] = React.useState(null)
  const timer = React.useRef(null)

  const dismiss = React.useCallback(() => {
    clearTimeout(timer.current)
    setToast(null)
  }, [])

  const show = React.useCallback(
    ({ title, description, action, duration = 6000 }) => {
      clearTimeout(timer.current)
      setToast({ title, description, action })
      if (duration) timer.current = setTimeout(() => setToast(null), duration)
    },
    []
  )

  React.useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2"
        aria-live="polite"
      >
        {toast && (
          <div className="pointer-events-auto flex animate-toast-in items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 shadow-xl">
            <div className="flex flex-col">
              {toast.title && (
                <span className="text-sm font-medium text-foreground">{toast.title}</span>
              )}
              {toast.description && (
                <span className="text-xs text-muted-foreground">{toast.description}</span>
              )}
            </div>
            {toast.action && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  toast.action.onClick()
                  dismiss()
                }}
              >
                {toast.action.label}
              </Button>
            )}
            <button
              onClick={dismiss}
              className={cn(
                'rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
              )}
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
