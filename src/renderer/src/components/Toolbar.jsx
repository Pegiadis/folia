import { FileText, FolderOpen, Combine, Save, Loader2, Info } from 'lucide-react'
import { Button } from './ui/button'

/** Top application bar: brand, primary file actions, and the live document name. */
export function Toolbar({ fileName, hasDoc, busy, onOpen, onMerge, onSave, onAbout }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <button
        onClick={onAbout}
        title="About Folia"
        className="-m-1 flex items-center gap-3 rounded-md p-1 transition-colors hover:bg-muted"
      >
        <div className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <FileText className="size-5" />
        </div>
        <div className="flex flex-col text-left leading-tight">
          <span className="text-sm font-semibold text-foreground">Folia</span>
          {fileName && (
            <span className="max-w-[280px] truncate text-xs text-muted-foreground">{fileName}</span>
          )}
        </div>
      </button>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onAbout} title="About Folia" aria-label="About Folia">
          <Info />
        </Button>
        <Button variant="secondary" onClick={onOpen} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <FolderOpen />}
          Open
        </Button>
        <Button variant="secondary" onClick={onMerge} disabled={!hasDoc || busy}>
          <Combine />
          Merge
        </Button>
        <Button onClick={onSave} disabled={!hasDoc || busy}>
          <Save />
          Save As
        </Button>
      </div>
    </header>
  )
}
