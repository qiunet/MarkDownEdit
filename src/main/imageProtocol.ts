import { protocol } from 'electron'
import { extname, resolve } from 'path'
import { readFile } from 'fs/promises'

function mimeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.avif':
      return 'image/avif'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'image/jpeg'
  }
}

export function registerImageProtocol(): void {
  protocol.handle('mdimage', async (request) => {
    try {
      const url = new URL(request.url)
      const filePath = url.searchParams.get('path')
      if (!filePath) {
        return new Response('Not found', { status: 404 })
      }

      const normalized = resolve(filePath)
      const data = await readFile(normalized)
      return new Response(data, {
        headers: {
          'Content-Type': mimeFromExt(extname(normalized)),
          'Cache-Control': 'no-cache'
        }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
