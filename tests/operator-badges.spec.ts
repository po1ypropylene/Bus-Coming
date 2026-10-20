import { expect, test } from './test'
import { seed } from './fixtures'
import { navigateTab } from './navigation'

for (const scheme of ['light', 'dark'] as const) {
    test(`operator badge fills remain distinct and readable in ${scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme })
        await seed(page)
        await navigateTab(page, 'Routes')
        // Exercise the real badge styling with all operators; catalogue data stays fixture-only.
        await page
            .locator('.route-badge')
            .first()
            .evaluate((badge) => {
                for (const provider of ['ctb', 'nlb']) {
                    const copy = badge.cloneNode(true) as HTMLElement
                    copy.className = `route-badge ${provider}`
                    copy.textContent = provider === 'ctb' ? '720' : '37'
                    badge.parentElement!.append(copy)
                }
            })
        for (const theme of ['green', 'blue', 'yellow', 'red', 'purple']) {
            await page.evaluate((theme) => {
                document.documentElement.dataset.theme = theme
            }, theme)
            for (const mode of ['full', 'reduced']) {
                await page.evaluate((mode) => {
                    document.documentElement.dataset.glassEffective = mode
                }, mode)
                const colours = await page.locator('.route-badge').evaluateAll((badges) => {
                    const luminance = (rgb: number[]) =>
                        rgb
                            .map((v) => v / 255)
                            .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
                            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
                    return badges.slice(0, 3).map((badge) => {
                        const css = getComputedStyle(badge)
                        const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number)
                        const fill = rgb(css.backgroundColor),
                            ink = rgb(css.color)
                        const a = luminance(fill),
                            b = luminance(ink)
                        return {
                            provider: badge.classList[1],
                            fill,
                            contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
                            filter: css.backdropFilter,
                        }
                    })
                })
                for (const colour of colours) {
                    expect(colour.fill).toHaveLength(3)
                    expect(colour.contrast).toBeGreaterThanOrEqual(4.5)
                    expect(colour.filter).toBe('none')
                    const [r, g, b] = colour.fill
                    if (colour.provider === 'kmb') expect(r - g).toBeGreaterThan(20)
                    if (colour.provider === 'ctb') expect(Math.min(r, g) - b).toBeGreaterThan(35)
                    if (colour.provider === 'nlb') expect(b - r).toBeGreaterThan(20)
                }
                expect(new Set(colours.map((colour) => colour.fill.join(','))).size).toBe(3)
            }
        }
        await page.screenshot({ path: test.info().outputPath(`operator-badges-${scheme}.png`) })
    })
}
