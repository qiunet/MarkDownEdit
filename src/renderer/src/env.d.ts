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
  onExportProgress: (
    callback: (progress: { current: number; total: number; fileName: string }) => void
  ) => () => void
  onExportFinished: (callback: () => void) => () => void
  exportToPdf: (nameOrPath: string) => Promise<string | null>
}

declare global {
  interface Window {
    fileApi: FileApi
  }
}

export {}
