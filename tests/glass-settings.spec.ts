import { expect, test } from './test'
import { seed } from './fixtures'
import { navigateTab } from './navigation'

test('glass preferences persist, reduce effects and keep backups intact', async ({ page }) => {
    await seed(page)
    await navigateTab(page, 'Settings')
    const slider = page.getByRole('slider', { name: 'Intensity', exact: true })
    await slider.fill('0.8')
    await page.getByLabel('Effects mode').selectOption('reduced')
    await page.getByRole('switch', { name: 'Refraction lens' }).uncheck()
    await expect(page.locator('html')).toHaveAttribute('data-glass-effective', 'reduced')
    expect(
        await page
            .locator('.tab-bar-surface')
            .evaluate((el) => getComputedStyle(el).backdropFilter),
    ).toBe('none')
    const stored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('bus-coming-user-v1')!),
    )
    expect(stored.glass).toEqual({ mode: 'reduced', intensity: 0.8, refraction: false })
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'reduced')
    await navigateTab(page, 'Settings')
    await expect(slider).toHaveValue('0.8')
    await page.getByLabel('Effects mode').selectOption('auto')
    await page.emulateMedia({ contrast: 'more' })
    await expect(page.locator('html')).toHaveAttribute('data-glass-effective', 'reduced')
    await page.getByLabel('Effects mode').selectOption('full')
    await expect(page.locator('html')).toHaveAttribute('data-glass-effective', 'full')
    await page.getByRole('button', { name: 'Language', exact: true }).click()
    await expect(page.getByRole('group', { name: '玻璃效果' })).toBeVisible()
})

test('lenses rotate IDs, settle, drag, and disable refraction cleanly', async ({ page }) => {
    await seed(page)
    const filter = () =>
        page
            .locator('.tab-bar .selection-lens-refract')
            .evaluate((el) => (el as HTMLElement).style.filter)
    const first = await filter()
    await navigateTab(page, 'Settings')
    expect(await filter()).not.toBe(first)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Nearby', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Nearby', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
    )
    const nav = await page.locator('.tab-bar').boundingBox()
    await page.mouse.move(nav!.x + 20, nav!.y + 20)
    await page.mouse.down()
    await page.mouse.move(nav!.x + nav!.width - 20, nav!.y + 20, { steps: 8 })
    await page.mouse.up()
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
    )
    await page.getByRole('switch', { name: 'Refraction lens' }).uncheck()
    expect(
        await page
            .locator('.tab-bar .selection-lens-refract')
            .evaluate((el) => getComputedStyle(el).filter),
    ).toBe('none')
    await navigateTab(page, 'Routes')
    if ((page.viewportSize()?.width ?? 0) <= 700) {
        await expect(page.locator('.tab-bar')).toBeHidden()
        await page.getByRole('button', { name: 'Hide keypad', exact: true }).click()
        await expect(page.locator('.tab-bar')).toBeVisible()
    }
})

test('glass surfaces never nest or use SVG backdrop filters', async ({ page }) => {
    await seed(page)
    for (const tab of ['Saved', 'Settings', 'Routes', 'Nearby']) {
        await navigateTab(page, tab)
        const result = await page.evaluate(() => {
            const visible = (el: Element) =>
                el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0
            const surfaces = [...document.querySelectorAll('*')].filter(
                (el) => visible(el) && getComputedStyle(el).backdropFilter !== 'none',
            )
            const nested = surfaces.some((el) =>
                surfaces.some((other) => el !== other && other.contains(el)),
            )
            return {
                count: surfaces.length,
                nested,
                svg: surfaces.some((el) => getComputedStyle(el).backdropFilter.includes('url(')),
            }
        })
        expect(result.nested).toBe(false)
        expect(result.svg).toBe(false)
        expect(result.count).toBeLessThanOrEqual(4)
    }
})
