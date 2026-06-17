import { BrowserWindow, dialog } from 'electron'
import MarkdownIt from 'markdown-it'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, dirname, join, relative, resolve } from 'path'
import { pathToFileURL } from 'url'
import { listAllMarkdownFiles } from './notebook'

const PDF_CSS = `
body {
  margin: 0;
  padding: 24px 32px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #222;
  background: #fff;
}
body.dark {
  color: #c9d1d9;
  background: #1e1e1e;
}
h1, h2, h3, h4, h5, h6 {
  margin: 24px 0 16px;
  font-weight: 600;
  line-height: 1.25;
}
h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid #d9dee4; }
h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid #d9dee4; }
h3 { font-size: 1.25em; }
h4 { font-size: 1em; }
h5 { font-size: 0.875em; }
h6 { font-size: 0.85em; color: #57606a; }
p, blockquote, ul, ol, dl, table, pre { margin: 0 0 16px; }
a { color: #539bf5; text-decoration: none; }
a:hover { text-decoration: underline; }
img { max-width: 100%; }
code {
  padding: 0.2em 0.4em;
  border-radius: 6px;
  background: #eff1f2;
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 0.9em;
}
pre {
  padding: 16px;
  overflow: auto;
  border-radius: 6px;
  background: #f6f8fa;
}
pre code {
  padding: 0;
  background: transparent;
}
blockquote {
  margin: 0;
  padding: 0 1em;
  color: #57606a;
  border-left: 0.25em solid #d0d7de;
}
ul, ol { padding-left: 2em; }
table {
  border-collapse: collapse;
  display: block;
  max-width: 100%;
  overflow: auto;
}
table th, table td {
  padding: 6px 13px;
  border: 1px solid #d0d7de;
}
table tr:nth-child(2n) {
  background: #f7f8fa;
}
hr {
  height: 1px;
  margin: 24px 0;
  border: none;
  background: #d0d7de;
}
body.dark h1, body.dark h2 { border-bottom-color: #373e47; }
body.dark code { background: #2d3339; color: #c9d1d9; }
body.dark pre { background: #161b22; }
body.dark blockquote { color: #8b949e; border-left-color: #444c56; }
body.dark table th, body.dark table td { border-color: #30363d; }
body.dark table tr:nth-child(2n) { background: #161b22; }
body.dark hr { background: #30363d; }
`

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getBaseDir(filePath: string | null): string {
  if (!filePath) return ''
  return resolve(filePath, '..')
}

function toPdfImageSrc(src: string, baseDir: string): string {
  if (!src || /^https?:\/\//i.test(src) || /^data:/i.test(src) || /^file:/i.test(src)) {
    return src
  }
  if (!baseDir) {
    return src
  }

  return pathToFileURL(resolve(baseDir, src)).href
}

function renderMarkdown(content: string, baseDir: string): string {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true
  })

  const defaultImageRender = md.renderer.rules.image
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const srcIndex = token.attrIndex('src')
    if (srcIndex >= 0 && token.attrs) {
      token.attrs[srcIndex][1] = toPdfImageSrc(token.attrs[srcIndex][1], baseDir)
    }
    return defaultImageRender!(tokens, idx, options, env, self)
  }

  return md.render(content)
}

function buildPdfHtml(content: string, filePath: string | null, theme: 'light' | 'dark'): string {
  const baseDir = getBaseDir(filePath)
  const body = renderMarkdown(content, baseDir)
  const title = filePath ? basename(filePath) : 'Markdown'
  const bodyClass = theme === 'dark' ? 'dark' : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>${PDF_CSS}</style>
</head>
<body class="${bodyClass}">
  <article class="markdown-body">
    ${body}
  </article>
</body>
</html>`
}

async function generatePdfBuffer(
  content: string,
  filePath: string | null,
  theme: 'light' | 'dark'
): Promise<Buffer> {
  const html = buildPdfHtml(content, filePath, theme)
  const tempDir = await mkdtemp(join(tmpdir(), 'md-pdf-'))
  const htmlPath = join(tempDir, 'export.html')

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  try {
    await writeFile(htmlPath, html, 'utf-8')
    await win.loadFile(htmlPath)

    await win.webContents.executeJavaScript(`
      Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise((resolve) => {
                img.onload = resolve
                img.onerror = resolve
              })
          )
      )
    `)

    return await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'default' }
    })
  } finally {
    win.close()
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function writePdfFile(
  content: string,
  filePath: string | null,
  theme: 'light' | 'dark',
  outputPath: string
): Promise<void> {
  const pdfData = await generatePdfBuffer(content, filePath, theme)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, pdfData)
}

async function showExportSuccessDialog(
  parent: BrowserWindow | null,
  savedPath: string
): Promise<void> {
  await dialog.showMessageBox(parent ?? undefined, {
    type: 'info',
    title: '导出成功',
    message: 'PDF 导出成功',
    detail: savedPath,
    buttons: ['确定'],
    noLink: true
  })
}

export interface ExportProgress {
  current: number
  total: number
  fileName: string
}

export async function exportMarkdownToPdf(
  parent: BrowserWindow | null,
  filePath: string,
  content: string,
  theme: 'light' | 'dark'
): Promise<string | null> {
  const defaultPath = basename(filePath).replace(/\.(md|markdown)$/i, '.pdf')
  const result = await dialog.showSaveDialog(parent ?? undefined, {
    title: '导出 PDF',
    defaultPath,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })

  if (result.canceled || !result.filePath) {
    return null
  }

  await writePdfFile(content, filePath, theme, result.filePath)
  await showExportSuccessDialog(parent, result.filePath)
  return result.filePath
}

export async function exportWorkspaceToPdf(
  parent: BrowserWindow | null,
  root: string,
  theme: 'light' | 'dark',
  onProgress: (progress: ExportProgress) => void
): Promise<{ outputDir: string; count: number } | null> {
  const files = await listAllMarkdownFiles(root)

  if (files.length === 0) {
    await dialog.showMessageBox(parent ?? undefined, {
      type: 'info',
      title: '导出 PDF',
      message: '工作区中没有可导出的 Markdown 文件',
      buttons: ['确定'],
      noLink: true
    })
    return null
  }

  const result = await dialog.showOpenDialog(parent ?? undefined, {
    title: '选择 PDF 导出目录',
    properties: ['openDirectory', 'createDirectory']
  })

  if (result.canceled || !result.filePaths[0]) {
    return null
  }

  const outputDir = result.filePaths[0]

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i]
    const fileName = basename(filePath)

    onProgress({ current: i + 1, total: files.length, fileName })

    const content = await readFile(filePath, 'utf-8')
    const relPath = relative(root, filePath)
    const pdfRelPath = relPath.replace(/\.(md|markdown)$/i, '.pdf')
    const outputPath = join(outputDir, pdfRelPath)

    await writePdfFile(content, filePath, theme, outputPath)
  }

  await dialog.showMessageBox(parent ?? undefined, {
    type: 'info',
    title: '导出成功',
    message: `已成功导出 ${files.length} 个 PDF 文件`,
    detail: outputDir,
    buttons: ['确定'],
    noLink: true
  })

  return { outputDir, count: files.length }
}
