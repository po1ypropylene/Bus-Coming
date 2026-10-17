import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
const svg = await readFile('public/favicon.svg')
for (const [size, name] of [
    [180, 'apple-touch-icon'],
    [192, 'icon-192'],
    [512, 'icon-512'],
])
    await sharp(svg)
        .resize(size, size)
        .flatten({ background: '#2464a5' })
        .png()
        .toFile(`public/${name}.png`)
