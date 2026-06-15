import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'resources', 'markdown.svg')
const buildDir = join(root, 'build')
const pngPath = join(buildDir, 'icon.png')

mkdirSync(buildDir, { recursive: true })

const svg = readFileSync(svgPath)

await sharp(svg, { density: 300 })
  .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png()
  .toFile(pngPath)

console.log('Generated', pngPath)
