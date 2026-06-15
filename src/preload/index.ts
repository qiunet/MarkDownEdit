import { contextBridge, ipcRenderer } from 'electron'

export interface FileApi {
  openFile: () => Promise<{ filePath: string; content: string } | null>
  saveFile: (content: string, saveAs?: boolean) => Promise<{ filePath: string } | null>
  getCurrentPath: () => Promise<string | null>
  newFile: () => Promise<void>
  setWindowTitle: (title: string) => Promise<void>
  getTheme: () => Promise<{ mode: 'system' | 'light' | 'dark'; resolved: 'light' | 'dark' }>
  onThemeChange: (callback: (theme: 'light' | 'dark') => void) => () => void
  saveImages: (images: Array<{ name: string; data: Uint8Array }>) => Promise<string[]>
  onMenuNew: (callback: () => void) => () => void
  onMenuOpen: (callback: () => void) => () => void
  onMenuSave: (callback: () => void) => () => void
  onMenuSaveAs: (callback: () => void) => () => void
}

const api: FileApi = {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content: string, saveAs = false) => ipcRenderer.invoke('dialog:saveFile', content, saveAs),
  getCurrentPath: () => ipcRenderer.invoke('file:getCurrentPath'),
  newFile: () => ipcRenderer.invoke('file:new'),
  setWindowTitle: (title: string) => ipcRenderer.invoke('window:setTitle', title),
  getTheme: () => ipcRenderer.invoke('theme:get'),
  onThemeChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, theme: 'light' | 'dark'): void => callback(theme)
    ipcRenderer.on('theme:changed', handler)
    return () => ipcRenderer.removeListener('theme:changed', handler)
  },
  saveImages: (images) => ipcRenderer.invoke('image:save', images),
  onMenuNew: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('menu:new', handler)
    return () => ipcRenderer.removeListener('menu:new', handler)
  },
  onMenuOpen: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('menu:open', handler)
    return () => ipcRenderer.removeListener('menu:open', handler)
  },
  onMenuSave: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('menu:save', handler)
    return () => ipcRenderer.removeListener('menu:save', handler)
  },
  onMenuSaveAs: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('menu:save-as', handler)
    return () => ipcRenderer.removeListener('menu:save-as', handler)
  }
}

contextBridge.exposeInMainWorld('fileApi', api)

declare global {
  interface Window {
    fileApi: FileApi
  }
}
