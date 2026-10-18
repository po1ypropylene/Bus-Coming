import { expect, test } from '@playwright/test'
import sharp from 'sharp'
import { seed } from './fixtures'

for (const colorScheme of ['light', 'dark'] as const) {
    test(`header fills the viewport and safe area in ${colorScheme} appearance`, async ({
        page,
    }) => {
        await page.emulateMedia({ colorScheme })
        // Browser emulation does not supply iPhone safe-area values.
        await page.route('**/src/styles/*.css', async (request) => {
            const response = await request.fetch()
            const body = (await response.text()).replaceAll('env(safe-area-inset-top)', '62px')
            await request.fulfill({ response, body })
        })
        await seed(page)
        for (const width of [320, 440, 1280]) {
            await page.setViewportSize({ width, height: 956 })
            for (const tab of ['Settings', 'Routes']) {
                await page.getByRole('button', { name: tab, exact: true }).click()
                const header = await page.locator('.app-header').boundingBox()
                const background = await page
                    .locator('.app-header')
                    .evaluate((element) =>
                        getComputedStyle(element).backgroundColor.match(/\d+/g)!.map(Number),
                    )
                const { data, info } = await sharp(await page.screenshot({ scale: 'css' }))
                    .removeAlpha()
                    .raw()
                    .toBuffer({ resolveWithObject: true })
                // Check both gutters, the centre and the route-search safe area above the header.
                for (const y of [2, Math.ceil(header!.y) + 2]) {
                    for (const x of [1, Math.floor(width / 2), width - 2]) {
                        const offset = (y * info.width + x) * info.channels
                        expect([...data.subarray(offset, offset + 3)]).toEqual(background)
                    }
                }
                // The bottom divider must be continuous through both viewport gutters.
                const dividerY = Math.round(header!.y + header!.height) - 1
                const dividerPixels = [1, Math.floor(width / 2), width - 2].map((x) => {
                    const offset = (dividerY * info.width + x) * info.channels
                    return [...data.subarray(offset, offset + 3)]
                })
                expect(dividerPixels[0]).not.toEqual(background)
                expect(dividerPixels[0]).toEqual(dividerPixels[1])
                expect(dividerPixels[2]).toEqual(dividerPixels[1])
                expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
            }
        }
    })
}
