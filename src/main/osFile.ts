import { app, BrowserWindow, dialog } from 'electron'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

const MARKDOWN_EXT = /\.(md|markdown)$/i

export interface ExternalFilePayload {
  filePath: string
  content: string
}

let rendererReady = false
const pendingExternalFiles: ExternalFilePayload[] = []
let getMainWindow: () => BrowserWindow | null = () => null
let setCurrentFilePath: (filePath: string) => void = () => {}

export function isMarkdownFile(filePath: string): boolean {
  return MARKDOWN_EXT.test(filePath)
}

export function getMarkdownPathFromArgv(argv: string[]): string | null {
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('-')) continue
    if (isMarkdownFile(arg)) {
      return arg
    }
  }
  return null
}

function deliverToRenderer(payload: ExternalFilePayload): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return

  win.show()
  win.focus()
  win.webContents.send('file:openExternal', payload)
}

export async function openExternalFile(filePath: string): Promise<void> {
  const win = getMainWindow()

  try {
    const absolutePath = resolve(filePath)
    const content = await readFile(absolutePath, 'utf-8')
    setCurrentFilePath(absolutePath)

    const payload: ExternalFilePayload = { filePath: absolutePath, content }

    if (rendererReady) {
      deliverToRenderer(payload)
    } else {
      pendingExternalFiles.push(payload)
    }
  } catch {
    await dialog.showMessageBox(win ?? undefined, {
      type: 'error',
      title: '打开失败',
      message: '无法打开 Markdown 文件',
      detail: filePath,
      buttons: ['确定']
    })
  }
}

export function markRendererReady(): ExternalFilePayload[] {
  rendererReady = true
  return pendingExternalFiles.splice(0)
}

export function initOsFileHandlers(
  getWindow: () => BrowserWindow | null,
  onCurrentFilePathChange: (filePath: string) => void
): boolean {
  getMainWindow = getWindow
  setCurrentFilePath = onCurrentFilePathChange

  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (isMarkdownFile(filePath)) {
      void openExternalFile(filePath)
    }
  })

  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return false
  }

  app.on('second-instance', (_event, commandLine) => {
    const filePath = getMarkdownPathFromArgv(commandLine)
    if (filePath) {
      void openExternalFile(filePath)
    } else {
      const win = getMainWindow()
      if (win) {
        if (win.isMinimized()) win.restore()
        win.focus()
      }
    }
  })

  return true
}
