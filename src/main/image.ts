import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, extname, join } from 'path'

export interface ImagePayload {
  name: string
  data: Uint8Array
}

export async function saveImages(mdFilePath: string, images: ImagePayload[]): Promise<string[]> {
  const mdDir = dirname(mdFilePath)
  const imagesDir = join(mdDir, 'MdImages')
  await mkdir(imagesDir, { recursive: true })

  const relativePaths: string[] = []

  for (const image of images) {
    const ext = extname(image.name) || '.png'
    const fileName = `${randomUUID()}${ext}`
    const absolutePath = join(imagesDir, fileName)
    await writeFile(absolutePath, Buffer.from(image.data))
    relativePaths.push(`MdImages/${fileName}`)
  }

  return relativePaths
}
