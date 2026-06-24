import { contextBridge, ipcRenderer } from 'electron'

// The renderer never touches the filesystem directly. It calls these thin,
// explicit bridges, and the main process owns all disk access.
const api = {
  /** Opens a file dialog and returns { name, data: Uint8Array } or null. */
  openPdf: () => ipcRenderer.invoke('pdf:open'),
  /** Opens a save dialog, writes bytes, returns { path, name } or null. */
  savePdf: (data, defaultName) => ipcRenderer.invoke('pdf:save', { data, defaultName }),
  /**
   * Subscribe to PDFs opened from outside the app (file association,
   * "Open with Folia", double-click). Returns an unsubscribe function.
   */
  onOpenFile: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('pdf:open-external', handler)
    return () => ipcRenderer.removeListener('pdf:open-external', handler)
  },

  /** The app version, e.g. "0.1.0". */
  getVersion: () => ipcRenderer.invoke('app:version'),

  /** Subscribe to auto-update status. Returns an unsubscribe function. */
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('update:status', handler)
    return () => ipcRenderer.removeListener('update:status', handler)
  },

  /** Quit and install a downloaded update. */
  installUpdate: () => ipcRenderer.invoke('update:install')
}

contextBridge.exposeInMainWorld('api', api)
