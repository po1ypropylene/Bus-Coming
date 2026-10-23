import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import {
    assertCapture,
    assertViewport,
    geometry,
    outputScale,
    restoreFrameTransparency,
} from './readme-image.mjs'

const { width, height } = geometry.screen

test('rejects scrollbar-reduced and mismatched Safari viewports', () => {
    assertViewport({ viewport: [width, height], client: [width, height] })
    assert.throws(() => assertViewport({ viewport: [width, height], client: [width - 17, height] }))
    assert.throws(() => assertViewport({ viewport: [402, 874], client: [402, 874] }))
})

test('rejects the previous white right/bottom gutter capture', async () => {
    const old = await sharp({ create: { width, height, channels: 4, background: 'white' } })
        .composite([
            {
                input: await sharp({
                    create: {
                        width: width - 17,
                        height: height - 17,
                        channels: 4,
                        background: '#18222f',
                    },
                })
                    .png()
                    .toBuffer(),
                left: 0,
                top: 0,
            },
        ])
        .png()
        .toBuffer()
    await assert.rejects(assertCapture(old, 1, true), /White gutter/)
    await assert.rejects(assertCapture(old, 2), /Wrong app capture width/)
})

test('restores transparent exterior and preserves white screen content and bezel feathering', async () => {
    const { width, height } = geometry.device
    const white = await sharp({ create: { width, height, channels: 4, background: 'white' } })
        .png()
        .toBuffer()
    const { data, info } = await sharp(await restoreFrameTransparency(white))
        .raw()
        .toBuffer({ resolveWithObject: true })
    assert.equal(info.width, width * outputScale)
    assert.equal(info.height, height * outputScale)
    for (const [x, y] of [
        [0, 0],
        [info.width - 1, 0],
        [0, info.height - 1],
        [info.width - 1, info.height - 1],
    ])
        assert.equal(data[(y * info.width + x) * 4 + 3], 0)
    const center = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4
    assert.deepEqual([...data.subarray(center, center + 4)], [255, 255, 255, 255])
    const original = await sharp('scripts/templates/iphone/bezel.png')
        .ensureAlpha()
        .raw()
        .toBuffer()
    const feather = original.findIndex(
        (value, index) => index % 4 === 3 && value > 0 && value < 255,
    )
    assert.ok(feather >= 0)
    assert.deepEqual(
        [...data.subarray(feather - 3, feather + 1)],
        [...original.subarray(feather - 3, feather + 1)],
    )
})

test('rejects a distorted phone canvas instead of silently resizing it', async () => {
    const wrong = await sharp({
        create: { width: 500, height: 968, channels: 4, background: 'white' },
    })
        .png()
        .toBuffer()
    await assert.rejects(restoreFrameTransparency(wrong), /canvas aspect ratio/)
})
