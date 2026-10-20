import { expect, test } from './test'
import { seed } from './fixtures'
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
