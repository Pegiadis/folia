# Folia

A fast, private desktop PDF editor that **never uploads your files** — everything happens locally on your machine. Built with Electron + React.

**Phase 1 (current):** Open a PDF, preview pages, select pages, **delete** them, and **Save As** a new file. Your original file on disk is never modified.

## Tech stack

- **Electron** — desktop shell (Windows)
- **Vite + React** — renderer UI, via `electron-vite`
- **Tailwind CSS** + shadcn-style components — flat slate/blue design system, Inter font, Lucide icons
- **pdf.js** (`pdfjs-dist`) — renders page thumbnails and the preview
- **pdf-lib** — modifies the document (delete pages; more to come)

The renderer never touches the filesystem. The main process owns all disk I/O and exposes a tiny, explicit bridge (`window.api.openPdf` / `savePdf`) via a sandboxed preload.

## Run it

```bash
npm install      # first time only
npm run dev      # launch the app with hot reload
```

## Build a Windows installer

```bash
npm run dist     # outputs to release/
```

## Project layout

```
src/
  main/index.js          Electron main process — windows + file dialogs/IO
  preload/index.js       contextBridge: window.api.openPdf / savePdf
  renderer/
    index.html
    src/
      App.jsx             state orchestration (open/delete/undo/reset/save)
      lib/pdf.js          render (pdf.js) + edit (pdf-lib) helpers
      components/         Toolbar, ThumbnailRail, PreviewPane, ActionBar
      components/ui/      Button, AlertDialog (confirm), Toast (undo)
```

## Roadmap

| Phase | Feature |
|-------|---------|
| 1 ✅ | Delete pages + Save As |
| 2 | Reorder / rotate / merge / split pages |
| 3 | Annotate & markup (highlight, text, shapes) |
| 4 | Fill forms & sign, then flatten |
| 5 | Edit existing text & images |
