import { Trash2, RotateCcw, RotateCw, Scissors, Undo2, History, CheckCircle2 } from 'lucide-react'
import { Button } from './ui/button'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel
} from './ui/alert-dialog'

/**
 * Bottom action bar.
 * - Rotate left/right and Delete act on the currently selected pages.
 * - Delete is destructive, so it sits behind a confirm dialog.
 * - Undo steps back through edits; Reset reverts to the opened document.
 */
export function ActionBar({
  selectedCount,
  pageCount,
  canUndo,
  dirty,
  busy,
  onRotateLeft,
  onRotateRight,
  onExtract,
  onDelete,
  onUndo,
  onReset
}) {
  const hasSelection = selectedCount > 0
  const deletingAll = selectedCount >= pageCount && pageCount > 0
  const canDelete = hasSelection && !deletingAll && !busy

  return (
    <footer className="flex h-14 shrink-0 items-center justify-between border-t border-border bg-card px-4">
      <div className="flex items-center gap-2">
        {/* Page operations on the current selection. */}
        <Button variant="secondary" onClick={onRotateLeft} disabled={!hasSelection || busy}>
          <RotateCcw />
          Rotate left
        </Button>
        <Button variant="secondary" onClick={onRotateRight} disabled={!hasSelection || busy}>
          <RotateCw />
          Rotate right
        </Button>
        <Button variant="secondary" onClick={onExtract} disabled={!hasSelection || busy}>
          <Scissors />
          Extract
        </Button>

        <div className="mx-1 h-6 w-px bg-border" />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={!canDelete}>
              <Trash2 />
              Delete{hasSelection ? ` (${selectedCount})` : ''}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {selectedCount} page{selectedCount === 1 ? '' : 's'}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                The selected pages will be removed from the working document. You can undo this, and
                your original file on disk is never changed until you choose Save As.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={onDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {deletingAll && (
          <span className="text-xs text-destructive">Can&apos;t delete every page.</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onUndo} disabled={!canUndo || busy}>
          <Undo2 />
          Undo
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" disabled={!dirty || busy}>
              <History />
              Reset
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all edits?</AlertDialogTitle>
              <AlertDialogDescription>
                This discards every change — page edits, annotations, signatures and form entries —
                and restores the document to the file you opened. Your original file on disk is not
                affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={onReset}
              >
                Reset everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="ml-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {hasSelection ? (
            <span className="tabular-nums">
              {selectedCount} of {pageCount} selected
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-accent" />
              Ready
            </span>
          )}
        </div>
      </div>
    </footer>
  )
}
