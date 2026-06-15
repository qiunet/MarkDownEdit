import { app, shell, BrowserWindow, ipcMain, dialog, Menu, nativeTheme, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { readFile, writeFile } from 'fs/promises'
import { loadSettings, saveSettings, type ThemeMode } from './settings'
import { saveImages } from './image'

let mainWindow: BrowserWindow | null = null
let currentFilePath: string | null = null
let themeMode: ThemeMode = 'system'

const isDev = !app.isPackaged

function getResolvedTheme(): 'light' | 'dark' {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

function broadcastTheme(): void {
  mainWindow?.webContents.send('theme:changed', getResolvedTheme())
}

async function setThemeMode(mode: ThemeMode): Promise<void> {
  themeMode = mode
  nativeTheme.themeSource = mode
  await saveSettings({ themeMode: mode })
  createMenu()
  broadcastTheme()
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

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.markdownedit.app')
  }

  const settings = await loadSettings()
  themeMode = settings.themeMode
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

ipcMain.handle('dialog:saveFile', async (_event, content: string, saveAs = false) => {
  let filePath = currentFilePath

  if (!filePath || saveAs) {
    const result = await dialog.showSaveDialog({
      title: '保存 Markdown 文件',
      defaultPath: filePath ?? 'untitled.md',
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    filePath = result.filePath
  }

  await writeFile(filePath, content, 'utf-8')
  currentFilePath = filePath

  return { filePath }
})

ipcMain.handle('file:getCurrentPath', () => currentFilePath)

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
