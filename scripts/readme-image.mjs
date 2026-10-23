import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

const template = new URL('./templates/iphone/', import.meta.url)
export const { geometry } = JSON.parse(await readFile(new URL('source.json', template), 'utf8'))
export const outputScale = geometry.outputScale

export function assertViewport({ viewport, client }, expected = geometry.screen) {
    assert.deepEqual(viewport, [expected.width, expected.height], 'Wrong Safari layout viewport')
    assert.deepEqual(client, viewport, 'Safari scrollbar gutters must not reduce the app viewport')
}

export async function assertCapture(png, backingScale, dark = false) {
    const { data, info } = await sharp(png)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
    assert.equal(info.width, geometry.screen.width * backingScale, 'Wrong app capture width')
    assert.equal(info.height, geometry.screen.height * backingScale, 'Wrong app capture height')
    if (dark) {
        for (const [x, y] of [
            [info.width - 1, Math.floor(info.height / 2)],
            [Math.floor(info.width / 2), info.height - 1],
        ]) {
            const offset = (y * info.width + x) * 4
            assert.ok(
                ![...data.subarray(offset, offset + 3)].every((value) => value > 240),
                'White gutter at the right or bottom of the dark app capture',
            )
        }
    }
}

// Restore the original bezel's exterior alpha, without keying out white app content.
// Safari viewport screenshots flatten transparent page backgrounds onto white.
export async function restoreFrameTransparency(png) {
    const { data: bezel, info } = await sharp(new URL('bezel.png', template).pathname)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
    assert.equal(info.width, geometry.device.width * outputScale)
    assert.equal(info.height, geometry.device.height * outputScale)
    const capture = await sharp(png).metadata()
    assert.equal(
        capture.width / geometry.device.width,
        capture.height / geometry.device.height,
        'Phone capture must match the canvas aspect ratio before normalization',
    )
    const rendered = await sharp(png).resize(info.width, info.height).ensureAlpha().raw().toBuffer()
    const count = info.width * info.height
    const exterior = new Uint8Array(count)
    const queue = new Uint32Array(count)
    let head = 0
    let tail = 0
    const visit = (index) => {
        if (!exterior[index] && bezel[index * 4 + 3] < 255) {
            exterior[index] = 1
            queue[tail++] = index
        }
    }
    for (let x = 0; x < info.width; x++) {
        visit(x)
        visit((info.height - 1) * info.width + x)
    }
    for (let y = 0; y < info.height; y++) {
        visit(y * info.width)
        visit((y + 1) * info.width - 1)
    }
    while (head < tail) {
        const index = queue[head++]
        const x = index % info.width
        if (x > 0) visit(index - 1)
        if (x < info.width - 1) visit(index + 1)
        if (index >= info.width) visit(index - info.width)
        if (index < count - info.width) visit(index + info.width)
    }
    assert.equal(
        exterior[Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)],
        0,
        'Bezel must enclose the screen opening',
    )
    for (let index = 0; index < count; index++) {
        if (exterior[index]) bezel.copy(rendered, index * 4, index * 4, index * 4 + 4)
    }
    return sharp(rendered, { raw: { width: info.width, height: info.height, channels: 4 } })
        .png()
        .toBuffer()
}
