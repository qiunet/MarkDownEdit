import { app, shell, BrowserWindow, ipcMain, dialog, Menu, nativeTheme, protocol, net } from 'electron'
import { join, resolve, relative } from 'path'
import { pathToFileURL } from 'url'
import { readFile, writeFile, stat } from 'fs/promises'
import { loadSettings, updateSettings, type ThemeMode } from './settings'
import { saveImages } from './image'
import { readDirectory, createMarkdownFile, createDirectory, deleteEntry } from './notebook'

let mainWindow: BrowserWindow | null = null
let currentFilePath: string | null = null
let themeMode: ThemeMode = 'system'
let notebookRoot: string | null = null
let sidebarCollapsed = false

const isDev = !app.isPackaged

function getNotebookState() {
  return { root: notebookRoot, sidebarCollapsed }
}

function broadcastNotebook(): void {
  mainWindow?.webContents.send('notebook:changed', getNotebookState())
}

function assertWithinNotebook(itemPath: string): void {
  if (!notebookRoot) {
    throw new Error('NO_NOTEBOOK')
  }

  const root = resolve(notebookRoot)
  const target = resolve(itemPath)
  const rel = relative(root, target)

  if (!rel || rel.startsWith('..') || rel.includes('..')) {
    throw new Error('OUT_OF_SCOPE')
  }

  if (target === root) {
    throw new Error('CANNOT_DELETE_ROOT')
  }
}

function getResolvedTheme(): 'light' | 'dark' {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

function broadcastTheme(): void {
  mainWindow?.webContents.send('theme:changed', getResolvedTheme())
}

async function setThemeMode(mode: ThemeMode): Promise<void> {
  themeMode = mode
  nativeTheme.themeSource = mode
  await updateSettings({ themeMode: mode })
  createMenu()
  broadcastTheme()
}

async function setNotebookRoot(root: string | null): Promise<void> {
  notebookRoot = root
  if (root) {
    sidebarCollapsed = false
  }
  await updateSettings({ notebookRoot: root, sidebarCollapsed })
  createMenu()
  broadcastNotebook()
}

async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
  if (!notebookRoot) return
  sidebarCollapsed = collapsed
  await updateSettings({ sidebarCollapsed: collapsed })
  createMenu()
  broadcastNotebook()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    title: 'MarkdownEdit - Untitled',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    broadcastTheme()
    mainWindow?.webContents.send('notebook:changed', getNotebookState())
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    const modKey = process.platform === 'darwin' ? input.meta : input.control
    if (!modKey) return

    const key = input.key.toLowerCase()

    if (key === 's') {
      event.preventDefault()
      if (input.shift) {
        mainWindow?.webContents.send('menu:save-as')
      } else {
        mainWindow?.webContents.send('menu:save')
      }
    } else if (key === 'n') {
      event.preventDefault()
      mainWindow?.webContents.send('menu:new')
    } else if (key === 'o') {
      event.preventDefault()
      mainWindow?.webContents.send('menu:open')
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new')
        },
        {
          label: '打开',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:open')
        },
        {
          label: '打开文件夹',
          click: () => void openNotebookFolder()
        },
        {
          label: '关闭文件夹',
          enabled: !!notebookRoot,
          click: () => void setNotebookRoot(null)
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save')
        },
        {
          label: '另存为',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu:save-as')
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '外观',
          submenu: [
            {
              label: '跟随系统',
              type: 'radio',
              checked: themeMode === 'system',
              click: () => void setThemeMode('system')
            },
            {
              label: '浅色',
              type: 'radio',
              checked: themeMode === 'light',
              click: () => void setThemeMode('light')
            },
            {
              label: '深色',
              type: 'radio',
              checked: themeMode === 'dark',
              click: () => void setThemeMode('dark')
            }
          ]
        },
        {
          label: sidebarCollapsed ? '展开侧边栏' : '收起侧边栏',
          enabled: !!notebookRoot,
          click: () => void setSidebarCollapsed(!sidebarCollapsed)
        },
        { type: 'separator' },
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function openNotebookFolder(): Promise<void> {
  const result = await dialog.showOpenDialog({
    title: '打开笔记本文件夹',
    properties: ['openDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return
  }

  await setNotebookRoot(result.filePaths[0])
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.markdownedit.app')
  }

  const settings = await loadSettings()
  themeMode = settings.themeMode
  notebookRoot = settings.notebookRoot
  sidebarCollapsed = settings.sidebarCollapsed
  nativeTheme.themeSource = themeMode

  protocol.handle('mdimage', async (request) => {
    try {
      const url = new URL(request.url)
      const filePath = url.searchParams.get('path')
      if (!filePath) {
        return new Response('Not found', { status: 404 })
      }
      return await net.fetch(pathToFileURL(filePath).toString())
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  nativeTheme.on('updated', () => {
    if (themeMode === 'system') {
      broadcastTheme()
    }
  })

  createMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    title: '打开 Markdown 文件',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const filePath = result.filePaths[0]
  const content = await readFile(filePath, 'utf-8')
  currentFilePath = filePath

  return { filePath, content }
})

ipcMain.handle('dialog:saveFile', async (_event, content: string, saveAs = false, filePath?: string | null) => {
  let targetPath = filePath ?? currentFilePath

  if (!targetPath || saveAs) {
    const result = await dialog.showSaveDialog({
      title: '保存 Markdown 文件',
      defaultPath: targetPath ?? 'untitled.md',
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    targetPath = result.filePath
  }

  await writeFile(targetPath, content, 'utf-8')
  currentFilePath = targetPath

  return { filePath: targetPath }
})

ipcMain.handle('file:getCurrentPath', () => currentFilePath)

ipcMain.handle('file:setCurrentPath', (_event, filePath: string | null) => {
  currentFilePath = filePath
})

ipcMain.handle('file:new', () => {
  currentFilePath = null
})

ipcMain.handle('window:setTitle', (_event, title: string) => {
  mainWindow?.setTitle(title)
})

ipcMain.handle('theme:get', () => ({
  mode: themeMode,
  resolved: getResolvedTheme()
}))

ipcMain.handle('image:save', async (_event, images: Array<{ name: string; data: Uint8Array }>) => {
  if (!currentFilePath) {
    throw new Error('SAVE_MD_FIRST')
  }

  return saveImages(currentFilePath, images)
})

ipcMain.handle('notebook:getState', () => getNotebookState())

ipcMain.handle('notebook:readDir', async (_event, dirPath: string) => {
  return readDirectory(dirPath)
})

ipcMain.handle('notebook:readFile', async (_event, filePath: string) => {
  const content = await readFile(filePath, 'utf-8')
  return { filePath, content }
})

ipcMain.handle('notebook:openFolder', async () => {
  await openNotebookFolder()
  return getNotebookState()
})

ipcMain.handle('notebook:close', async () => {
  await setNotebookRoot(null)
  return getNotebookState()
})

ipcMain.handle('notebook:setSidebarCollapsed', async (_event, collapsed: boolean) => {
  await setSidebarCollapsed(collapsed)
  return getNotebookState()
})

ipcMain.handle('notebook:createFile', async (_event, dirPath: string, fileName: string) => {
  return createMarkdownFile(dirPath, fileName)
})

ipcMain.handle('notebook:createFolder', async (_event, parentPath: string, folderName: string) => {
  return createDirectory(parentPath, folderName)
})

ipcMain.handle('notebook:showInExplorer', async (_event, itemPath: string) => {
  const info = await stat(itemPath)
  if (info.isDirectory()) {
    await shell.openPath(itemPath)
  } else {
    shell.showItemInFolder(itemPath)
  }
})

ipcMain.handle('notebook:delete', async (_event, itemPath: string) => {
  assertWithinNotebook(itemPath)
  await deleteEntry(itemPath)
})
