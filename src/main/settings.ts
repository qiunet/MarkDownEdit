import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'

export type ThemeMode = 'system' | 'light' | 'dark'

export interface Settings {
  themeMode: ThemeMode
  notebookRoot: string | null
  sidebarCollapsed: boolean
}

const defaultSettings: Settings = {
  themeMode: 'system',
  notebookRoot: null,
  sidebarCollapsed: false
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await readFile(getSettingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Settings> & { sidebarVisible?: boolean }
    const sidebarCollapsed =
      parsed.sidebarCollapsed ?? (parsed.sidebarVisible === false ? true : defaultSettings.sidebarCollapsed)
    return { ...defaultSettings, ...parsed, sidebarCollapsed }
  } catch {
    return { ...defaultSettings }
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const path = getSettingsPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(settings, null, 2), 'utf-8')
}

export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings()
  const next = { ...current, ...partial }
  await saveSettings(next)
  return next
}
