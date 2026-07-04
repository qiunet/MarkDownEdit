import { app, dialog, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

const CHECK_INTERVAL_MS = 30 * 60 * 1000

let manualCheck = false
let userConfirmedDownload = false
let checking = false
let getMainWindow: (() => BrowserWindow | null) | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

function isDevMode(): boolean {
  return !app.isPackaged
}

function showDialog(options: Electron.MessageBoxOptions): void {
  void dialog.showMessageBox(getMainWindow?.() ?? undefined, options)
}

async function promptDownloadUpdate(version: string): Promise<void> {
  const devMode = isDevMode()
  const { response } = await dialog.showMessageBox(getMainWindow?.() ?? undefined, {
    type: 'info',
    title: '检查更新',
    message: '有新版本',
    detail: devMode
      ? `当前版本：v${app.getVersion()}\n新版本：v${version}\n\n（开发模式仅检查，不下载更新）`
      : `当前版本：v${app.getVersion()}\n新版本：v${version}`,
    buttons: devMode ? ['知道了'] : ['知道了', '立刻下载'],
    defaultId: devMode ? 0 : 1,
    cancelId: 0
  })

  if (devMode || response !== 1) {
    return
  }

  userConfirmedDownload = true
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    userConfirmedDownload = false
    getMainWindow?.()?.setProgressBar(-1)
    const message = error instanceof Error ? error.message : '未知错误'
    showDialog({
      type: 'error',
      title: '检查更新',
      message: '下载更新失败',
      detail: message,
      buttons: ['确定']
    })
  }
}

function registerUpdaterEvents(): void {
  autoUpdater.on('update-available', (info) => {
    void promptDownloadUpdate(info.version)
  })

  autoUpdater.on('update-not-available', () => {
    if (manualCheck) {
      showDialog({
        type: 'info',
        title: '检查更新',
        message: '当前已是最新版本',
        detail: `当前版本 v${app.getVersion()}`,
        buttons: ['确定']
      })
    }
    manualCheck = false
  })

  autoUpdater.on('download-progress', (progress) => {
    if (userConfirmedDownload) {
      getMainWindow?.()?.setProgressBar(progress.percent / 100)
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    getMainWindow?.()?.setProgressBar(-1)
    if (!userConfirmedDownload) {
      return
    }

    userConfirmedDownload = false
    void dialog
      .showMessageBox(getMainWindow?.() ?? undefined, {
        type: 'info',
        title: '更新就绪',
        message: `新版本 v${info.version} 已下载`,
        detail: '重启应用以完成更新。如有未保存内容，请先保存。',
        buttons: ['立即重启', '稍后'],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true)
        }
      })
  })

  autoUpdater.on('error', (error) => {
    getMainWindow?.()?.setProgressBar(-1)
    if (manualCheck || userConfirmedDownload) {
      showDialog({
        type: 'error',
        title: '检查更新',
        message: '检查更新失败',
        detail: error.message,
        buttons: ['确定']
      })
    }
    manualCheck = false
    userConfirmedDownload = false
  })
}

export function initUpdater(getWindow: () => BrowserWindow | null): void {
  getMainWindow = getWindow

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  if (isDevMode()) {
    autoUpdater.forceDevUpdateConfig = true
    registerUpdaterEvents()
    return
  }

  registerUpdaterEvents()
  void checkForUpdates()
  intervalId = setInterval(() => {
    void checkForUpdates()
  }, CHECK_INTERVAL_MS)
}

export async function checkForUpdates(manual = false): Promise<void> {
  if (checking) {
    if (manual) {
      showDialog({
        type: 'info',
        title: '检查更新',
        message: '正在检查更新，请稍候…',
        buttons: ['确定']
      })
    }
    return
  }

  manualCheck = manual
  checking = true

  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    getMainWindow?.()?.setProgressBar(-1)
    if (manualCheck) {
      const message = error instanceof Error ? error.message : '未知错误'
      showDialog({
        type: 'error',
        title: '检查更新',
        message: '检查更新失败',
        detail: message,
        buttons: ['确定']
      })
    }
    manualCheck = false
  } finally {
    checking = false
  }
}

export function disposeUpdater(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
