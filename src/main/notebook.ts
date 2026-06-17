import { readdir, writeFile, mkdir, rm, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { join, extname } from 'path'

export interface DirEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  editable?: boolean
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'release', 'MdImages'])

const MARKDOWN_EXTS = new Set(['.md', '.markdown'])

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
    } else if (entry.isFile()) {
      result.push({
        name: entry.name,
        path: fullPath,
        type: 'file',
        editable: isMarkdownFile(entry.name)
      })
    }
  }

  return result.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
}

export async function listAllMarkdownFiles(dirPath: string): Promise<string[]> {
  const entries = await readDirectory(dirPath)
  const files: string[] = []

  for (const entry of entries) {
    if (entry.type === 'directory') {
      files.push(...(await listAllMarkdownFiles(entry.path)))
    } else if (entry.editable !== false) {
      files.push(entry.path)
    }
  }

  return files
}

function validateEntryName(name: string): void {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('INVALID_NAME')
  }
  if (/[\\/:*?"<>|]/.test(trimmed)) {
    throw new Error('INVALID_CHARS')
  }
}

export async function createMarkdownFile(
  dirPath: string,
  fileName: string
): Promise<{ filePath: string; content: string }> {
  validateEntryName(fileName)

  const trimmed = fileName.trim()
  const safeName = trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`
  const filePath = join(dirPath, safeName)

  if (existsSync(filePath)) {
    throw new Error('ALREADY_EXISTS')
  }

  await writeFile(filePath, '', 'utf-8')
  return { filePath, content: '' }
}

export async function createDirectory(
  parentPath: string,
  folderName: string
): Promise<{ dirPath: string }> {
  validateEntryName(folderName)

  const dirPath = join(parentPath, folderName.trim())

  if (existsSync(dirPath)) {
    throw new Error('ALREADY_EXISTS')
  }

  await mkdir(dirPath)
  return { dirPath }
}

export async function deleteEntry(itemPath: string): Promise<void> {
  const info = await stat(itemPath)
  await rm(itemPath, { recursive: info.isDirectory(), force: true })
}
