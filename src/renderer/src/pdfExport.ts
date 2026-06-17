export async function exportNotebookFileToPdf(nameOrPath: string): Promise<boolean> {
  try {
    const savedPath = await window.fileApi.exportToPdf(nameOrPath)
    return savedPath !== null
  } catch {
    alert('导出 PDF 失败，请重试')
    return false
  }
}
