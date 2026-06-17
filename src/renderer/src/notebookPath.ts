function toNotebookRelativePath(root: string, filePath: string): string {
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/$/, '')
  const normalizedPath = filePath.replace(/\\/g, '/')

  if (normalizedPath === normalizedRoot) {
    return ''
  }

  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1)
  }

  return filePath
}

export { toNotebookRelativePath }
