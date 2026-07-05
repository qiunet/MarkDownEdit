import { app } from 'electron'
import { readFile, writeFile, mkdir, unlink } from 'fs/promises'
import { join, dirname } from 'path'

export interface SessionTab {
  filePath: string | null
  content: string
}

export interface EditorSession {
  tabs: SessionTab[]
  activeTabIndex: number
}

function getSessionPath(): string {
  return join(app.getPath('userData'), 'session.json')
}

export async function loadSession(): Promise<EditorSession | null> {
  try {
    const raw = await readFile(getSessionPath(), 'utf-8')
    const parsed = JSON.parse(raw) as EditorSession
    if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function saveSession(session: EditorSession): Promise<void> {
  const path = getSessionPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(session, null, 2), 'utf-8')
}

export async function clearSession(): Promise<void> {
  try {
    await unlink(getSessionPath())
  } catch {
    // ignore missing file
  }
}
