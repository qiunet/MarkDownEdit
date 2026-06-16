import { readdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, extname } from 'path'

export interface DirEntry {
  name: string
  path: string
  type: 'file' | 'directory'
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'release', 'MdImages'])

const MARKDOWN_EXTS = new Set(['.md', '.markdown', '.txt'])

function isMarkdownFile(name: string): boolean {
  return MARKDOWN_EXTS.has(extname(name).toLowerCase())
}

export async function readDirectory(dirPath: string): Promise<DirEntry[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const result: DirEntry[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const fullPath = join(dirPath, entry.name)

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      result.push({ name: entry.name, path: fullPath, type: 'directory' })
    } else if (entry.isFile() && isMarkdownFile(entry.name)) {
      result.push({ name: entry.name, path: fullPath, type: 'file' })
    }
  }

  return result.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
}

export async function createMarkdownFile(
  dirPath: string,
  fileName: string
): Promise<{ filePath: string; content: string }> {
  const trimmed = fileName.trim()
  if (!trimmed) {
    throw new Error('INVALID_NAME')
  }

  if (/[\\/:*?"<>|]/.test(trimmed)) {
    throw new Error('INVALID_CHARS')
  }

  const safeName = trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`
  const filePath = join(dirPath, safeName)

  if (existsSync(filePath)) {
    throw new Error('FILE_EXISTS')
  }

  await writeFile(filePath, '', 'utf-8')
  return { filePath, content: '' }
}
