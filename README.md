# Folia

A fast, private desktop PDF editor for Windows that **never uploads your files** — every edit happens locally on your machine. Built with Electron + React.

**🔒 100% offline · 🆓 free & open source (MIT) · 🌐 [folia.duckdns.org](https://folia.duckdns.org)**

## Download

Get the latest installer from **[folia.duckdns.org](https://folia.duckdns.org)** (or the [portable `.zip`](https://folia.duckdns.org/download/Folia-Portable.zip)).

> On first run, Windows SmartScreen shows *"Windows protected your PC"* because the app isn't code-signed yet. It's safe — click **More info → Run anyway**. Folia then installs with a Start Menu + desktop shortcut and auto-updates itself on future releases.

## Features

- **Page operations** — delete, reorder (drag & drop), rotate, merge, and split/extract pages
- **Annotate & markup** — highlight, free text, shapes, freehand pen, and an eraser to undo any markup
- **Fill forms & sign** — type into interactive form fields; draw or type a signature and place it anywhere
- **Continuous scroll view** — read the whole document, not one page at a time
- **Reset & undo** — step back any edit, or reset the document to its original state
- **Open with Folia** — set as the default PDF app, or double-click any PDF to open it
- **Truly private** — no accounts, no cloud, no tracking; your original file on disk is never modified

## Tech stack

- **Electron** + **electron-vite** — desktop shell and bundling (main / preload / renderer)
- **Vite + React 18** — renderer UI
- **Tailwind CSS** + shadcn-style components — flat slate/blue design system, Inter font, Lucide icons
- **pdf.js** (`pdfjs-dist`) — renders thumbnails and pages to canvas
- **pdf-lib** — modifies the document (pages, annotations burn-in, form fill, signatures)
- **electron-updater** — silent background auto-update from a generic feed
- **electron-builder** — NSIS installer + portable build

The renderer never touches the filesystem. The main process owns all disk I/O and exposes a tiny, explicit bridge (`window.api`) over a sandboxed preload (`contextIsolation: true`, `nodeIntegration: false`).

## Develop

```bash
npm install      # first time only
npm run dev      # launch the app with hot reload
```

## Build a Windows installer

```bash
npm run dist     # outputs installer + update feed to release/
```

See **[RELEASING.md](RELEASING.md)** for the full release + auto-update publishing flow.

## Project layout

```
src/
  main/index.js          Electron main — windows, file I/O, file association, auto-update
  preload/index.js       contextBridge: openPdf / savePdf / onOpenFile / update API
  renderer/src/
    App.jsx              state orchestration (open/edit/annotate/sign/save)
    lib/
      pdf.js             render (pdf.js) + page edits (pdf-lib) + inspectPdf
      annotations.js     annotation model + burn-in to the PDF
      forms.js           read/fill interactive form fields
    components/          Toolbar, ThumbnailRail, DocumentView, AnnotationToolbar,
                         AnnotationLayer, FormFieldLayer, SignatureDialog, AboutDialog
    components/ui/        Button, AlertDialog, Toast
docs/                    landing page (folia.duckdns.org) + demo videos
build/                   app icons
```

## Privacy

Folia does not collect, transmit, or upload anything. All PDF processing happens
on your device. The only network request the app makes is a silent check for
app updates against its own update feed.

## License

[MIT](LICENSE) © 2026 Ioannis Pegiadis
