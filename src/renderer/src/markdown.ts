import { config } from 'md-editor-v3'
import type MarkdownIt from 'markdown-it'

let mdBaseDir = ''

export function setMdBaseDir(dir: string | null): void {
  mdBaseDir = dir ? dir.replace(/\\/g, '/') : ''
}

function joinPath(base: string, relative: string): string {
  const normalizedBase = base.replace(/[/\\]+$/, '')
  const normalizedRelative = relative.replace(/^[/\\]+/, '').split(/[/\\]/).join('/')
  return `${normalizedBase}/${normalizedRelative}`
}

function toPreviewImageSrc(src: string): string {
  if (!src || /^https?:\/\//i.test(src) || /^data:/i.test(src) || src.startsWith('mdimage://')) {
    return src
  }
  if (!mdBaseDir) {
    return src
  }

  const abs = joinPath(mdBaseDir, src)
  return `mdimage://local?path=${encodeURIComponent(abs)}`
}

config({
  markdownItConfig(md) {
    const instance = md as MarkdownIt
    instance.set({
      html: true,
      linkify: true,
      typographer: true,
      breaks: true
    })

    const defaultImageRender = instance.renderer.rules.image
    instance.renderer.rules.image = (tokens, idx, options, env, self) => {
      const token = tokens[idx]
      const srcIndex = token.attrIndex('src')
      if (srcIndex >= 0 && token.attrs) {
        token.attrs[srcIndex][1] = toPreviewImageSrc(token.attrs[srcIndex][1])
      }
      return defaultImageRender!(tokens, idx, options, env, self)
    }
  }
})
