import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'

export type ThemeMode = 'system' | 'light' | 'dark'

interface Settings {
  themeMode: ThemeMode
}

const defaultSettings: Settings = {
  themeMode: 'system'
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await readFile(getSettingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...defaultSettings, ...parsed }
  } catch {
    return { ...defaultSettings }
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const path = getSettingsPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(settings, null, 2), 'utf-8')
}
