import { navigateTab } from './navigation'
import { expect, test } from './test'
import sharp from 'sharp'
import { openStop, seed } from './fixtures'

for (const colorScheme of ['light', 'dark'] as const) {
    test(`glass chrome transmits its backdrop in ${colorScheme} appearance`, async ({ page }) => {
        await page.emulateMedia({ colorScheme })
        await page.setViewportSize({ width: 390, height: 844 })
        await seed(page)
        // A controlled underlay tests rendered transmission, not just a CSS declaration.
        // It is independent of operator data and removed before capturing the real UI.
        await page.evaluate(() => {
            const probe = document.createElement('div')
            probe.id = 'glass-probe'
            Object.assign(probe.style, {
                position: 'fixed',
                inset: '0',
                zIndex: '1',
                pointerEvents: 'none',
            })
            document.body.append(probe)
        })
        const nav = page.locator('.tab-bar')
        const sample = async (color: string) => {
            await page.locator('#glass-probe').evaluate((element, color) => {
                element.style.background = color
            }, color)
            const { data, info } = await sharp(await nav.screenshot({ scale: 'css' }))
                .removeAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true })
            const offset = (12 * info.width + Math.floor(info.width / 2)) * info.channels
            return [...data.subarray(offset, offset + 3)]
        }
        const red = await sample('rgb(150, 80, 80)')
        const blue = await sample('rgb(80, 80, 150)')
        expect(red[0] - blue[0]).toBeGreaterThan(40)
        expect(blue[2] - red[2]).toBeGreaterThan(40)
        await page.locator('#glass-probe').evaluate((element) => element.remove())
        for (const tab of ['Saved', 'Nearby', 'Routes', 'Settings']) {
            await navigateTab(page, tab)
            const material = await nav.evaluate((element) => {
                const style = getComputedStyle(element.querySelector('.tab-bar-surface')!)
                return {
                    filter:
                        style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter'),
                    background: style.backgroundColor,
                }
            })
            expect(material.filter).toContain('blur')
            expect(material.background).toContain('0.')
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true)
        }
        await page.screenshot({ path: test.info().outputPath(`glass-settings-${colorScheme}.png`) })
        await openStop(page)
        await page.getByRole('button', { name: 'Save stop', exact: true }).click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await page.screenshot({ path: test.info().outputPath(`glass-sheet-${colorScheme}.png`) })
        await page.getByRole('button', { name: 'Close', exact: true }).click()
        await page.emulateMedia({ contrast: 'more' })
        await expect(page.locator('html')).toHaveAttribute('data-glass-effective', 'reduced')
        expect(
            await nav.evaluate(
                (element) =>
                    getComputedStyle(element.querySelector('.tab-bar-surface')!).backdropFilter,
            ),
        ).toBe('none')
        const fallback = await nav.evaluate(
            (element) =>
                getComputedStyle(element.querySelector('.tab-bar-surface')!).backgroundColor,
        )
        expect(fallback).not.toContain('0.')
    })
}

test('the lens paints the selected label rather than the first label', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
    await seed(page)
    await navigateTab(page, 'Settings')
    await page.addStyleTag({ content: '.tab-bar > button { visibility: hidden }' })
    const clip = page.locator('.tab-bar .selection-lens-clip')
    const actual = await sharp(await clip.screenshot({ scale: 'css' }))
        .raw()
        .toBuffer()
    // An independent local reference contains only the selected label. Comparing rendered
    // pixels catches Safari shifting the first label into the lens despite correct DOM bounds.
    await page.locator('.tab-bar .selection-lens-copy').evaluate((element) => {
        const selected = element.lastElementChild!.cloneNode(true)
        element.replaceChildren(selected)
        const copy = element as HTMLElement
        copy.style.left = '0'
        copy.style.width = '100%'
        copy.style.gridTemplateColumns = '1fr'
        const nav = element.closest('nav')!
        const old = nav.querySelector('filter')!
        const filter = old.cloneNode(true) as SVGFilterElement
        filter.id = 'reference-lens'
        old.parentElement!.append(filter)
        ;(nav.querySelector('.selection-lens-refract') as HTMLElement).style.filter =
            'url(#reference-lens)'
    })
    const reference = await sharp(await clip.screenshot({ scale: 'css' }))
        .raw()
        .toBuffer()
    expect(actual.length).toBe(reference.length)
    let changed = 0
    for (let i = 0; i < actual.length; i++) if (Math.abs(actual[i] - reference[i]) > 20) changed++
    expect(changed / actual.length).toBeLessThan(0.02)
})

test('operator lens marks All on first entry and follows subsequent selections', async ({
    page,
}) => {
    await seed(page)
    await navigateTab(page, 'Routes')
    const track = page.locator('.operator-tabs')
    const lens = track.locator('.selection-lens')
    for (const label of ['All', 'KMB/LWB', 'Citybus', 'All']) {
        const button = track.getByRole('button', { name: label, exact: true })
        if (label !== 'All' || (await track.getAttribute('data-operator')) !== 'all')
            await button.click()
        await expect(button).toHaveAttribute('aria-pressed', 'true')
        await expect(async () => {
            const selected = await button.boundingBox()
            const highlight = await lens.boundingBox()
            expect(highlight!.width).toBeGreaterThan(44)
            expect(Math.abs(highlight!.x - selected!.x)).toBeLessThan(1)
            expect(Math.abs(highlight!.width - selected!.width)).toBeLessThan(1)
        }).toPass()
    }
    await navigateTab(page, 'Saved')
    await navigateTab(page, 'Routes')
    await expect(lens).toHaveJSProperty(
        'offsetWidth',
        await track
            .getByRole('button', { name: 'All', exact: true })
            .evaluate((element) => element.offsetWidth),
    )
})
