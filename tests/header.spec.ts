import { expect, test } from './test'
import { route, seed, stop } from './fixtures'
import { navigateTab } from './navigation'

for (const colorScheme of ['light', 'dark'] as const) {
    test(`header gains full-width material only after scrolling in ${colorScheme}`, async ({
        page,
    }) => {
        await page.emulateMedia({ colorScheme })
        await seed(page)
        await navigateTab(page, 'Settings')
        for (const width of [320, 440, 1280]) {
            await page.setViewportSize({ width, height: 568 })
            await page.evaluate(() => window.scrollTo(0, 0))
            await expect(page.locator('.app-header')).not.toHaveClass(/is-scrolled/)
            await page.evaluate(() => window.scrollTo(0, 240))
            await expect(page.locator('.app-header')).toHaveClass(/is-scrolled/)
            expect(
                await page
                    .locator('.app-header')
                    .evaluate((el) => parseFloat(getComputedStyle(el, '::before').width)),
            ).toBe(width)
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
        }
    })
}

test('compact route header aligns back with the left curve and centres the title', async ({
    page,
}) => {
    await seed(page, 2, {
        stop,
        route: {
            ...route,
            destination: {
                en: 'Sai Wan Ho (Grand Promenade)',
                tc: '西灣河（嘉亨灣）',
            },
            stops: Array.from({ length: 20 }, (_, index) => ({ id: stop.id, seq: index + 1 })),
        },
    })
    await navigateTab(page, 'Routes')
    await page.locator('.route-row').first().click()
    const header = page.locator('.route-compact-header')
    for (const language of ['en', 'tc']) {
        if (language === 'tc')
            await page.getByRole('button', { name: 'Language', exact: true }).click()
        for (const width of [320, 440, 1280]) {
            await page.setViewportSize({ width, height: 568 })
            await page.evaluate(() => window.scrollTo(0, 700))
            await expect(header).toBeVisible()
            const back = header.getByRole('button')
            await expect(back).toHaveAccessibleName(language === 'en' ? 'Routes' : '路線')
            const bounds = (await header.boundingBox())!
            const button = (await back.boundingBox())!
            const title = (await header.locator('strong').boundingBox())!
            expect(Math.abs(button.x - bounds.x)).toBeLessThan(1)
            expect(Math.abs(button.y - bounds.y)).toBeLessThan(1)
            expect(Math.abs(button.height - bounds.height)).toBeLessThan(1)
            expect(Math.abs(button.width - button.height)).toBeLessThan(1)
            expect(button.width).toBeGreaterThanOrEqual(44)
            expect(button.height).toBeGreaterThanOrEqual(44)
            expect(button.x + button.width).toBeLessThanOrEqual(title.x)
            expect(
                Math.abs(title.x + title.width / 2 - (bounds.x + bounds.width / 2)),
            ).toBeLessThan(1)
            expect(
                await header.locator('strong').evaluate((el) => getComputedStyle(el).textAlign),
            ).toBe('center')
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
            if (language === 'tc' && width === 440)
                await page.screenshot({
                    path: test.info().outputPath('route-header-left-curve.png'),
                })
        }
    }
    await header.getByRole('button').click()
    await expect(page.locator('.route-heading')).toHaveCount(0)
    await expect(page.locator('.route-search-shell')).toBeVisible()
})
