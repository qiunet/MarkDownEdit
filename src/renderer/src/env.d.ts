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

declare global {
  interface Window {
    fileApi: FileApi
  }
}

export {}
