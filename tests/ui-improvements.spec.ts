import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { openStop, route, seed, stop } from './fixtures'

const numbers = ['1A', '1B', '11X', '12', '15', '18', '2', 'N1']

test('keypad follows matching routes and leaves four rows visible at 390×844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await seed(page, 2, { route, stop }, numbers)
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await page.getByRole('button', { name: '1', exact: true }).click()
    await expect(page.getByRole('button', { name: 'A', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'N', exact: true })).toHaveCount(0)
    await expect(page.locator('.letter-keys button')).toHaveText(['A', 'B', 'X'])
    await expect(page.locator('.route-copy strong').first()).toHaveText('To Star Ferry')
    const list = await page.locator('.search-results').boundingBox()
    const fourth = await page.locator('.route-row').nth(3).boundingBox()
    expect(fourth!.y + fourth!.height).toBeLessThanOrEqual(list!.y + list!.height)
    await page.getByRole('button', { name: 'A', exact: true }).click()
    await expect(page.locator('.route-row')).toHaveCount(1)
    await expect(page.locator('.letter-keys')).toHaveCount(0)
    await page.getByRole('button', { name: 'Delete last character', exact: true }).click()
    await expect(page.getByRole('textbox')).toHaveValue('1')
    await expect(page.locator('.letter-keys button')).toHaveText(['A', 'B', 'X'])
    await page.locator('.keypad').getByRole('button', { name: 'Clear', exact: true }).click()
    await expect(page.getByRole('textbox')).toHaveValue('')
    await expect(page.getByRole('button', { name: 'N', exact: true })).toBeEnabled()
})

test('number and action keys stay in place when filtered letters disappear and return', async ({
    page,
}) => {
    await seed(page, 2, { route, stop }, numbers)
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    const keyBounds = () =>
        page.locator('.number-keys button').evaluateAll((keys) =>
            keys.map((key) => {
                const { x, y, width, height } = key.getBoundingClientRect()
                return { x, y, width, height }
            }),
        )

    for (const viewport of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
        { width: 440, height: 956 },
        { width: 1280, height: 900 },
    ]) {
        await page.setViewportSize(viewport)
        await page.getByRole('button', { name: '1', exact: true }).click()
        await expect(page.locator('.letter-keys button')).toHaveText(['A', 'B', 'X'])
        const before = await keyBounds()

        await page.getByRole('button', { name: 'A', exact: true }).click()
        await expect(page.locator('.letter-keys')).toHaveCount(0)
        await expect.poll(keyBounds).toEqual(before)

        await page.getByRole('button', { name: 'Delete last character', exact: true }).click()
        await expect(page.locator('.letter-keys button')).toHaveText(['A', 'B', 'X'])
        await expect.poll(keyBounds).toEqual(before)

        await page.locator('.keypad').getByRole('button', { name: 'Clear', exact: true }).click()
        await expect(page.getByRole('button', { name: 'N', exact: true })).toBeEnabled()
        await expect.poll(keyBounds).toEqual(before)
    }
})

test('last content clears navigation on each tab and details at requested widths', async ({
    page,
}) => {
    await seed(page, 2, { route, stop }, numbers)
    for (const width of [360, 390, 768]) {
        await page.setViewportSize({ width, height: 844 })
        for (const tab of ['Saved', 'Nearby', 'Settings', 'Routes']) {
            await page.getByRole('button', { name: tab, exact: true }).last().click()
            if (tab === 'Routes' && width <= 700) {
                await page.locator('.search-results').evaluate((el) => {
                    el.scrollTop = el.scrollHeight
                })
                const last = await page.locator('.route-row').last().boundingBox()
                const keypad = await page.locator('.keypad').boundingBox()
                expect(last!.y + last!.height + 8).toBeLessThanOrEqual(keypad!.y)
            } else {
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
                const bottom = await page
                    .locator(
                        tab === 'Saved'
                            ? '.home-note'
                            : tab === 'Settings'
                              ? '.about'
                              : tab === 'Nearby'
                                ? '.location-card'
                                : '.search-results',
                    )
                    .boundingBox()
                const nav = await page.locator('.tab-bar').boundingBox()
                expect(bottom!.y + bottom!.height + 15).toBeLessThanOrEqual(nav!.y)
            }
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true)
        }
        await page.locator('.route-row').last().click()
        await page.locator('.stop-main').click()
        await expect(page.locator('.arrival-time')).toBeVisible()
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        const lastStop = await page.locator('.stop-row').last().boundingBox()
        const nav = await page.locator('.tab-bar').boundingBox()
        expect(lastStop!.y + lastStop!.height + 15).toBeLessThanOrEqual(nav!.y)
    }
})

test('ETA states fit their content, retain remarks, and show full-size balanced due labels', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const now = Date.now()
    await page.clock.install({ time: now })
    await page.clock.pauseAt(now + 1000)
    await seed(page)
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    let mode = 'loading'
    await page.route('**/eta/**', async (request) => {
        if (mode === 'loading') await gate
        if (mode === 'error') return request.abort('failed')
        const minutes = mode === 'multiple' ? [0, 0.5, 1] : [1, 20, 38]
        return request.fulfill({
            json: {
                data:
                    mode === 'empty'
                        ? []
                        : minutes.map((minute) => ({
                              dir: 'O',
                              seq: 1,
                              service_type: 1,
                              eta: new Date(now + minute * 60000).toISOString(),
                              rmk_en: 'Scheduled',
                              rmk_tc: '預定班次',
                          })),
            },
        })
    })
    await openStop(page)
    await expect(page.locator('.arrival-skeleton')).toBeVisible()
    expect((await page.locator('.arrival-panel').boundingBox())!.height).toBeLessThan(210)
    mode = 'ready'
    release!()
    await expect(page.locator('.arrival-time')).toHaveCount(3)
    await expect(page.locator('.arrival-clock').first()).toContainText(/\d{2}:\d{2}/)
    await expect(page.locator('.arrival-remark').first()).toHaveText('Scheduled')
    expect((await page.locator('.arrival-panel').boundingBox())!.height).toBeLessThan(210)
    await page.getByRole('button', { name: 'Language', exact: true }).click()
    await expect(page.locator('.arrival-time strong')).toHaveText(['就到', '20', '38'])
    const sizes = await page
        .locator('.arrival-time strong')
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).fontSize))
    expect(new Set(sizes).size).toBe(1)
    const widths = await page
        .locator('.arrival-time')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width))
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1)
    await page.screenshot({ path: test.info().outputPath('balanced-due.png') })
    await page.clock.fastForward(16000)
    await expect(page.locator('.arrival-foot')).toContainText('16 秒前更新')
    mode = 'multiple'
    await page.getByRole('button', { name: '重新整理', exact: true }).click()
    await expect(page.locator('.arrival-rows')).toHaveCount(0)
    await expect(page.locator('.arrival-time strong')).toHaveText(['就到', '就到', '就到'])
    const countdowns = page.locator('.arrival-time strong')
    for (const width of [320, 360, 390]) {
        await page.setViewportSize({ width, height: 844 })
        const positions = await countdowns.evaluateAll((els) =>
            els.map((el) => ({
                top: el.getBoundingClientRect().top,
                size: getComputedStyle(el).fontSize,
            })),
        )
        expect(new Set(positions.map((item) => item.top)).size).toBe(1)
        expect(new Set(positions.map((item) => item.size)).size).toBe(1)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        )
    }
    await page.screenshot({ path: test.info().outputPath('multiple-due.png') })
    await page.setViewportSize({ width: 1280, height: 900 })
    expect((await page.locator('.arrival-panel').boundingBox())!.height).toBeLessThan(210)
    await page.setViewportSize({ width: 390, height: 844 })
    expect((await page.locator('.arrival-panel').boundingBox())!.height).toBeLessThan(210)
    mode = 'empty'
    await page.clock.fastForward(16000)
    await page.getByRole('button', { name: '重新整理', exact: true }).click()
    await expect(page.locator('.arrival-panel')).toContainText('暫無班次資料')
    expect((await page.locator('.arrival-panel').boundingBox())!.height).toBeLessThan(210)
    mode = 'error'
    await page.clock.fastForward(16000)
    await page.getByRole('button', { name: '重新整理', exact: true }).click()
    await page.clock.resume()
    await expect(page.getByRole('button', { name: '重試到站資料' })).toBeVisible()
    await expect(page.locator('.connection')).toHaveText('到站資料未更新')
    mode = 'ready'
    await page.getByRole('button', { name: '重試到站資料' }).click()
    await expect(page.locator('.arrival-time')).toHaveCount(3)
    await expect(page.locator('.connection')).toHaveText('即時到站')
    await page.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
        window.dispatchEvent(new Event('offline'))
    })
    await expect(page.locator('.connection')).toHaveText('離線')
    await expect(page.locator('.arrival-panel')).toHaveClass(/stale/)
    await expect(page.getByRole('button', { name: '重新整理', exact: true })).toBeDisabled()
})

test('polling pauses offscreen, hidden and unfocused, resumes, and marks old results stale', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.clock.install()
    await seed(page, 2, {
        route: {
            ...route,
            stops: Array.from({ length: 12 }, (_, i) => ({ id: stop.id, seq: i + 1 })),
        },
        stop,
    })
    let requests = 0
    await page.route('**/eta/**', (request) => {
        requests++
        return request.fulfill({
            json: {
                data: [
                    {
                        dir: 'O',
                        seq: 1,
                        service_type: 1,
                        eta: new Date(Date.now() + 300000).toISOString(),
                    },
                ],
            },
        })
    })
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await page.locator('.route-row').first().click()
    await page.locator('.stop-main').first().click()
    await expect(page.locator('.arrival-time')).toHaveCount(1)
    expect(requests).toBe(1)
    await page.clock.fastForward(31000)
    await expect.poll(() => requests).toBe(2)
    await page.evaluate(() => {
        Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false })
        window.dispatchEvent(new Event('blur'))
    })
    await page.clock.fastForward(91000)
    expect(requests).toBe(2)
    await expect(page.locator('.connection')).toHaveText('Arrivals stale')
    await page.evaluate(() => {
        Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => true })
        window.dispatchEvent(new Event('focus'))
    })
    await expect.poll(() => requests).toBe(3)
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
        document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.clock.fastForward(61000)
    expect(requests).toBe(3)
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
        document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect.poll(() => requests).toBe(4)
    await page.locator('.stop-main').last().scrollIntoViewIfNeeded()
    // Let IntersectionObserver deliver the offscreen transition before advancing timers.
    await expect(page.locator('.arrival-panel')).not.toBeInViewport()
    await page.clock.runFor(100)
    await page.clock.fastForward(61000)
    expect(requests).toBe(4)
    await page.locator('.arrival-panel').scrollIntoViewIfNeeded()
    await expect.poll(() => requests).toBe(5)
})

test('saving and removing a favourite persist without losing preferences', async ({ page }) => {
    await seed(page)
    await openStop(page)
    await page.getByRole('button', { name: 'Save stop', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.reload()
    await expect(page.locator('.bookmark-card')).toHaveCount(1)
    await page.getByRole('button', { name: 'Remove saved stop', exact: true }).click()
    await page.reload()
    await expect(page.locator('.bookmark-card')).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'blue')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('all five themes pass AA text contrast and accessibility on every tab in both appearances', async ({
    page,
}) => {
    test.setTimeout(180000)
    await page.setViewportSize({ width: 390, height: 844 })
    await seed(page)
    await openStop(page)
    await page.getByRole('button', { name: 'Save stop', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    const measurements: unknown[] = []
    for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme })
        for (const theme of ['Green', 'Blue', 'Yellow', 'Red', 'Purple']) {
            await page.getByRole('button', { name: 'Settings', exact: true }).click()
            await page.getByRole('radio', { name: theme, exact: true }).check()
            const tokens = await page.evaluate(() => {
                const style = getComputedStyle(document.documentElement)
                return Object.fromEntries(
                    ['muted', 'accent', 'ink', 'warning', 'surface', 'bg', 'soft', 'line'].map(
                        (name) => [name, style.getPropertyValue(`--${name}`).trim()],
                    ),
                )
            })
            const luminance = (hex: string) => {
                const full =
                    hex.length === 4 ? '#' + [...hex.slice(1)].map((v) => v + v).join('') : hex
                const rgb = [1, 3, 5]
                    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
                    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
                return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
            }
            for (const fg of ['muted', 'accent', 'ink', 'warning']) {
                for (const bg of ['surface', 'bg', 'soft', 'line']) {
                    const a = luminance(tokens[fg]),
                        b = luminance(tokens[bg])
                    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
                    measurements.push({ scheme, theme, fg, bg, ratio })
                    expect(ratio, `${scheme} ${theme} ${fg}/${bg}`).toBeGreaterThanOrEqual(4.5)
                }
            }
            for (const tab of ['Settings', 'Saved', 'Routes', 'Nearby']) {
                await page.getByRole('button', { name: tab, exact: true }).click()
                const scan = await new AxeBuilder({ page })
                    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
                    .analyze()
                expect(scan.violations, `${scheme} ${theme} ${tab}`).toEqual([])
            }
            await page.getByRole('button', { name: 'Routes', exact: true }).click()
            await page.locator('.route-row').first().click()
            await page.locator('.stop-main').click()
            await expect(page.locator('.arrival-time')).toHaveCount(1)
            const detailScan = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
                .analyze()
            expect(detailScan.violations, `${scheme} ${theme} details`).toEqual([])
        }
    }
    await test.info().attach('contrast-measurements', {
        body: JSON.stringify(measurements, null, 2),
        contentType: 'application/json',
    })
})

test('untimed operator messages are hidden with three predictions or no predictions', async ({
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 568 })
    const now = Date.now()
    await page.clock.install({ time: now })
    await seed(page)
    let timed = true
    await page.route('**/eta/**', (request) =>
        request.fulfill({
            json: {
                data: [
                    {
                        dir: 'O',
                        seq: 1,
                        service_type: 1,
                        eta: null,
                        rmk_en: 'No service',
                        rmk_tc: '暫停服務',
                    },
                    ...(timed
                        ? [6, 21, 30].map((minute) => ({
                              dir: 'O',
                              seq: 1,
                              service_type: 1,
                              eta: new Date(now + minute * 60000).toISOString(),
                              rmk_en: 'Scheduled Bus',
                              rmk_tc: '預定班次',
                          }))
                        : []),
                ],
            },
        }),
    )
    await openStop(page)
    await expect(page.locator('.arrival-time')).toHaveCount(3)
    await expect(page.locator('.arrival-remark')).toHaveText([
        'Scheduled Bus',
        'Scheduled Bus',
        'Scheduled Bus',
    ])
    await expect(page.locator('.arrival-message')).toHaveCount(0)
    await expect(page.locator('.arrival-panel')).not.toContainText('No service')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    timed = false
    await page.clock.fastForward(16000)
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.locator('.arrival-time')).toHaveCount(0)
    await expect(page.locator('.arrival-panel')).toContainText('No arrival estimate')
    await expect(page.locator('.arrival-message')).toHaveCount(0)
    await expect(page.locator('.arrival-panel')).not.toContainText('No service')
    await page.getByRole('button', { name: 'Language', exact: true }).click()
    await expect(page.locator('.arrival-message')).toHaveCount(0)
    await expect(page.locator('.arrival-panel')).not.toContainText('暫停服務')
    await expect(page.locator('.arrival-panel')).toContainText('暫無班次資料')
})
