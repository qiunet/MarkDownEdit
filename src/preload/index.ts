import { contextBridge, ipcRenderer } from 'electron'

export interface DirEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  editable?: boolean
}

export interface NotebookState {
  root: string | null
  sidebarCollapsed: boolean
}

export interface FileApi {
  openFile: () => Promise<{ filePath: string; content: string } | null>
  saveFile: (content: string, saveAs?: boolean, filePath?: string | null) => Promise<{ filePath: string } | null>
  writeFile: (content: string, filePath: string) => Promise<void>
  getCurrentPath: () => Promise<string | null>
  setCurrentPath: (filePath: string | null) => Promise<void>
  newFile: () => Promise<void>
  setWindowTitle: (title: string) => Promise<void>
  getTheme: () => Promise<{ mode: 'system' | 'light' | 'dark'; resolved: 'light' | 'dark' }>
  onThemeChange: (callback: (theme: 'light' | 'dark') => void) => () => void
  saveImages: (images: Array<{ name: string; data: Uint8Array }>) => Promise<string[]>
  getNotebookState: () => Promise<NotebookState>
  openNotebookFolder: () => Promise<NotebookState>
  readNotebookDir: (dirPath: string) => Promise<DirEntry[]>
  readNotebookFile: (filePath: string) => Promise<{ filePath: string; content: string }>
  createNotebookFile: (dirPath: string, fileName: string) => Promise<{ filePath: string; content: string }>
  createNotebookFolder: (parentPath: string, folderName: string) => Promise<{ dirPath: string }>
  showInExplorer: (itemPath: string) => Promise<void>
  deleteNotebookEntry: (itemPath: string) => Promise<void>
  setSidebarCollapsed: (collapsed: boolean) => Promise<NotebookState>
  onNotebookChange: (callback: (state: NotebookState) => void) => () => void
  onMenuNew: (callback: () => void) => () => void
  onMenuOpen: (callback: () => void) => () => void
  onMenuSave: (callback: () => void) => () => void
  onMenuSaveAs: (callback: () => void) => () => void
  signalReady: () => Promise<Array<{ filePath: string; content: string }>>
  onOpenExternalFile: (callback: (file: { filePath: string; content: string }) => void) => () => void
  onExportProgress: (
    callback: (progress: { current: number; total: number; fileName: string }) => void
  ) => () => void
  onExportFinished: (callback: () => void) => () => void
  exportToPdf: (nameOrPath: string) => Promise<string | null>
}

const api: FileApi = {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content: string, saveAs = false, filePath?: string | null) =>
    ipcRenderer.invoke('dialog:saveFile', content, saveAs, filePath),
  writeFile: (content: string, filePath: string) => ipcRenderer.invoke('file:write', content, filePath),
  getCurrentPath: () => ipcRenderer.invoke('file:getCurrentPath'),
  setCurrentPath: (filePath: string | null) => ipcRenderer.invoke('file:setCurrentPath', filePath),
  newFile: () => ipcRenderer.invoke('file:new'),
  setWindowTitle: (title: string) => ipcRenderer.invoke('window:setTitle', title),
  getTheme: () => ipcRenderer.invoke('theme:get'),
  onThemeChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, theme: 'light' | 'dark'): void => callback(theme)
    ipcRenderer.on('theme:changed', handler)
    return () => ipcRenderer.removeListener('theme:changed', handler)
  },
  saveImages: (images) => ipcRenderer.invoke('image:save', images),
  getNotebookState: () => ipcRenderer.invoke('notebook:getState'),
  openNotebookFolder: () => ipcRenderer.invoke('notebook:openFolder'),
  readNotebookDir: (dirPath: string) => ipcRenderer.invoke('notebook:readDir', dirPath),
  readNotebookFile: (filePath: string) => ipcRenderer.invoke('notebook:readFile', filePath),
  createNotebookFile: (dirPath: string, fileName: string) =>
    ipcRenderer.invoke('notebook:createFile', dirPath, fileName),
  createNotebookFolder: (parentPath: string, folderName: string) =>
    ipcRenderer.invoke('notebook:createFolder', parentPath, folderName),
  showInExplorer: (itemPath: string) => ipcRenderer.invoke('notebook:showInExplorer', itemPath),
  deleteNotebookEntry: (itemPath: string) => ipcRenderer.invoke('notebook:delete', itemPath),
  setSidebarCollapsed: (collapsed: boolean) => ipcRenderer.invoke('notebook:setSidebarCollapsed', collapsed),
  onNotebookChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, state: NotebookState): void => callback(state)
    ipcRenderer.on('notebook:changed', handler)
    return () => ipcRenderer.removeListener('notebook:changed', handler)
  },
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
  },
  signalReady: () => ipcRenderer.invoke('file:signalReady'),
  onOpenExternalFile: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      file: { filePath: string; content: string }
    ): void => callback(file)
    ipcRenderer.on('file:openExternal', handler)
    return () => ipcRenderer.removeListener('file:openExternal', handler)
  },
  onExportProgress: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: { current: number; total: number; fileName: string }
    ): void => callback(progress)
    ipcRenderer.on('export:progress', handler)
    return () => ipcRenderer.removeListener('export:progress', handler)
  },
  onExportFinished: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('export:finished', handler)
    return () => ipcRenderer.removeListener('export:finished', handler)
  },
  exportToPdf: (nameOrPath: string) => ipcRenderer.invoke('export:pdf', nameOrPath)
}

contextBridge.exposeInMainWorld('fileApi', api)

declare global {
  interface Window {
    fileApi: FileApi
  }
}
