import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename, extname } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

let mainWindow = null
// A PDF path captured before the window/renderer is ready to receive it.
let pendingFile = null
// Guard so we only kick off the update check / pending file once.
let booted = false

/**
 * Check for updates in the background (packaged builds only) and report
 * progress to the renderer so it can surface a "Restart to update" prompt.
 */
function setupAutoUpdate(win) {
  if (!app.isPackaged) return
  // Microsoft Store (MSIX) builds are updated by the Store, not electron-updater.
  if (process.windowsStore) return
  const send = (payload) => {
    if (win && !win.isDestroyed()) win.webContents.send('update:status', payload)
  }
  autoUpdater.autoDownload = true
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info?.version }))
  autoUpdater.on('download-progress', (p) => send({ state: 'downloading', percent: Math.round(p?.percent || 0) }))
  autoUpdater.on('update-downloaded', (info) => send({ state: 'ready', version: info?.version }))
  // Network errors / no feed configured: stay silent, don't nag the user.
  autoUpdater.on('error', () => {})
  autoUpdater.checkForUpdates().catch(() => {})
}

/** Pick the first existing *.pdf path out of a process argv array, if any. */
function pdfPathFromArgv(argv) {
  // In production argv = [exe, file, ...flags]; in dev = [electron, '.', ...].
  const hit = argv
    .slice(1)
    .find((arg) => arg && !arg.startsWith('-') && extname(arg).toLowerCase() === '.pdf' && existsSync(arg))
  return hit || null
}

/** Read a PDF off disk and hand it to the renderer (or queue it if not ready). */
async function openExternalFile(path) {
  if (!path) return
  try {
    const buffer = await readFile(path)
    const payload = { name: basename(path), data: new Uint8Array(buffer) }
    if (mainWindow && !mainWindow.webContents.isLoading()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      mainWindow.webContents.send('pdf:open-external', payload)
    } else {
      pendingFile = payload
    }
  } catch {
    // Unreadable file: ignore — the app still opens to an empty state.
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 880,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    title: 'Folia',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Once the renderer has loaded, flush any file we were asked to open and
  // start the update check (only on the first, real load — not on reloads).
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFile) {
      mainWindow.webContents.send('pdf:open-external', pendingFile)
      pendingFile = null
    }
    if (!booted) {
      booted = true
      setupAutoUpdate(mainWindow)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite injects this in dev; falls back to the built file in production.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- IPC: open a PDF from disk ------------------------------------------------
ipcMain.handle('pdf:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open PDF',
    properties: ['openFile'],
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
  })
  if (canceled || filePaths.length === 0) return null

  const path = filePaths[0]
  const buffer = await readFile(path)
  // Send raw bytes; structured clone handles Uint8Array over IPC.
  return { name: basename(path), data: new Uint8Array(buffer) }
})

// --- IPC: save edited PDF bytes to a new file --------------------------------
ipcMain.handle('pdf:save', async (_event, { data, defaultName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save PDF As',
    defaultPath: defaultName || 'edited.pdf',
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return null

  await writeFile(filePath, Buffer.from(data))
  return { path: filePath, name: basename(filePath) }
})

// --- IPC: app version (for the About dialog) ---------------------------------
ipcMain.handle('app:version', () => app.getVersion())

// --- IPC: quit and install a downloaded update -------------------------------
ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall()
})

// Only one Folia instance: a second launch (e.g. double-clicking another PDF)
// forwards its file to the running window instead of opening a new one.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    openExternalFile(pdfPathFromArgv(argv))
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // macOS delivers file-open via this event rather than argv.
  app.on('open-file', (event, path) => {
    event.preventDefault()
    openExternalFile(path)
  })

  app.whenReady().then(() => {
    // A PDF may have been passed on the very first launch.
    pendingFile = null
    const startupFile = pdfPathFromArgv(process.argv)

    createWindow()
    if (startupFile) openExternalFile(startupFile)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
