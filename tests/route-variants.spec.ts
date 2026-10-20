import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'
import { timetableFixture, variantRoute, variantStops } from '../src/services/variants/fixtures'
import type { Page } from '@playwright/test'

async function prepare(
    page: Page,
    anchor = false,
    patterns: 'multiple' | 'none' | 'single' | 'duplicate' = 'multiple',
) {
    const catalog = timetableFixture()
    if (patterns === 'none') catalog.variants = []
    if (patterns === 'single') catalog.variants = catalog.variants.slice(0, 1)
    if (patterns === 'duplicate')
        catalog.variants = [catalog.variants[0], { ...catalog.variants[0], id: 'TD:9999:1' }]
    await page.clock.install({ time: new Date('2026-10-20T07:55:00+08:00') })
    await page.context().route('https://portal.csdi.gov.hk/**', (req) => req.abort())
    await page.context().route('**/eta/**', (req) =>
        req.fulfill({
            json: {
                data: [
                    {
                        co: 'CTB',
                        route: '720',
                        dir: 'O',
                        stop: req.request().url().split('/').at(-2),
                        seq: 2,
                        eta: '2026-10-20T08:00:00+08:00',
                        dest_en: 'Wing Wo Street',
                    },
                    { co: 'CTB', route: '720', dir: 'I', seq: 2, eta: '2026-10-20T07:56:00+08:00' },
                ],
            },
        }),
    )
    await page.addInitScript(
        ({ route, stops, catalog, anchor }) => {
            const stop = stops['CTB:000004']
            localStorage.setItem(
                'bus-coming-user-v1',
                JSON.stringify({
                    version: 1,
                    language: 'en',
                    theme: 'purple',
                    bookmarks: anchor
                        ? [
                              {
                                  id: 'old-bookmark',
                                  routeId: route.id,
                                  stopId: stop.id,
                                  seq: 4,
                                  group: 'Work',
                                  route,
                                  stop,
                              },
                          ]
                        : [],
                }),
            )
            const request = indexedDB.open('bus-coming-v1', 2)
            request.onupgradeneeded = () => {
                request.result.createObjectStore('snapshots', { keyPath: 'provider' })
                request.result.createObjectStore('responses')
                request.result.createObjectStore('generations')
                request.result.createObjectStore('routeCatalogs', { keyPath: 'provider' })
                request.result.createObjectStore('routeDetails', { keyPath: 'id' })
            }
            request.onsuccess = () => {
                const tx = request.result.transaction(['snapshots', 'responses'], 'readwrite')
                for (const provider of ['KMB', 'CTB', 'NLB'])
                    tx.objectStore('snapshots').put({
                        provider,
                        updatedAt: Date.now(),
                        routes: provider === 'CTB' ? [route] : [],
                        stops: provider === 'CTB' ? stops : {},
                        stopRoutes: {},
                    })
                // Preserve refreshed cache on reload; startup must be able to restore it.
                const existing = tx.objectStore('responses').get('td-citybus-variants-v1')
                existing.onsuccess = () => {
                    if (!existing.result)
                        tx.objectStore('responses').put(
                            {
                                at: Date.now(),
                                generation: 1,
                                data: { ...catalog, updatedAt: Date.now() },
                            },
                            'td-citybus-variants-v1',
                        )
                }
                tx.oncomplete = () => request.result.close()
            }
        },
        { route: variantRoute, stops: variantStops, catalog, anchor },
    )
    await page.goto('/')
}

async function open720(page: Page) {
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await page.getByRole('textbox', { name: 'Route number' }).fill('720')
    await page.locator('.route-row').click()
}

test('selects morning/normal itineraries, preserves manual choice, and retains operator ETA identities', async ({
    page,
}) => {
    await prepare(page)
    await open720(page)
    const picker = page.getByRole('combobox', { name: 'Route variant', exact: true })
    await expect(page.locator('.variant-name')).toHaveText('Morning · Wing Wo Street')
    await expect(page.locator('.route-heading h1')).toHaveText('To Wing Wo Street')
    await expect(page.locator('.stop-main')).toHaveCount(4)
    expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
            .violations,
    ).toEqual([])
    await expect(page.locator('.stop-main').filter({ hasText: 'Normal stop' })).toHaveCount(0)
    await page.locator('.stop-main').filter({ hasText: 'Shared stop' }).click()
    await expect(page.locator('.arrival-time')).toHaveCount(1)
    await expect(page.locator('.arrival-clock')).toHaveText('08:00')
    await page.getByRole('button', { name: 'Save stop', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    const saved = await page.evaluate(
        () => JSON.parse(localStorage.getItem('bus-coming-user-v1')!).bookmarks[0],
    )
    expect(saved.routeId).toBe('CTB:720:O:1')
    expect(saved.stopId).toBe('CTB:000002')
    expect(saved.seq).toBe(2)
    expect(saved.route.stops).toHaveLength(6)
    await picker.selectOption('TD:1775:1')
    await page.clock.fastForward(2 * 60 * 60 * 1000)
    await expect(page.locator('.variant-name')).toHaveText('Morning · Wing Wo Street')
    await picker.selectOption('auto')
    await expect(page.locator('.variant-name')).toHaveText('Normal · Macao Ferry')
    await expect(page.locator('.stop-main').filter({ hasText: 'Normal stop' })).toHaveCount(1)
    await picker.selectOption('operator')
    await expect(page.locator('.stop-main')).toHaveCount(6)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
        path: `artifacts/variants-${test.info().project.name}.png`,
        fullPage: true,
    })
})

test('a saved stop restricts the automatic choice to variants serving it and restores the timetable offline', async ({
    page,
    context,
}) => {
    await prepare(page, true)
    await page.locator('.bookmark-route').click()
    await expect(page.locator('.variant-name')).toHaveText('Normal · Macao Ferry')
    await expect(page.locator('.stop-row.expanded')).toContainText('Normal stop')
    await context.setOffline(true)
    // Reload a cached timetable through the existing origin; the dev shell itself
    // is tested offline separately against the production service worker.
    await context.setOffline(false)
    await page.reload()
    await page.locator('.bookmark-route').click()
    await context.setOffline(true)
    await expect(page.locator('.variant-name')).toHaveText('Normal · Macao Ferry')
    await expect(page.getByRole('combobox', { name: 'Route variant', exact: true })).toBeEnabled()
    await page
        .getByRole('combobox', { name: 'Route variant', exact: true })
        .selectOption('TD:1775:1')
    await expect(page.locator('.stop-main').filter({ hasText: 'Morning stop' })).toHaveCount(1)
    await expect(page.locator('.stop-main').filter({ hasText: 'Normal stop' })).toHaveCount(0)
    expect(
        await page.evaluate(
            () => JSON.parse(localStorage.getItem('bus-coming-user-v1')!).bookmarks[0].id,
        ),
    ).toBe('old-bookmark')
})

test('automatic selection advances with the clock and exposes Traditional Chinese controls', async ({
    page,
}) => {
    await prepare(page)
    await open720(page)
    await expect(page.locator('.variant-name')).toHaveText('Morning · Wing Wo Street')
    await page.clock.fastForward(70 * 60 * 1000)
    await expect(page.locator('.variant-name')).toHaveText('Normal · Macao Ferry')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('tc')
    await page.getByRole('button', { name: '路線', exact: true }).click()
    await page.getByRole('textbox').fill('720')
    await page.locator('.route-row').click()
    await expect(page.getByRole('combobox', { name: '路線班次', exact: true })).toBeVisible()
    await expect(page.locator('.variant-name')).toHaveText('正常 · 港澳碼頭')
    await expect(page.locator('.variant-picker')).toContainText('香港時間')
})

for (const patterns of ['none', 'single', 'duplicate'] as const) {
    test(`preserves the previous route UI for ${patterns} timetable alternatives`, async ({
        page,
    }) => {
        await prepare(page, false, patterns)
        await open720(page)
        await expect(page.locator('.route-heading h1')).toHaveText('To Central')
        await expect(page.locator('.stop-main')).toHaveCount(6)
        await expect(page.locator('.variant-picker')).toHaveCount(0)
        await expect(page.locator('.variant-name')).toHaveCount(0)
        await expect(
            page.getByText('Loading route variants. The operator stop list remains available.', {
                exact: true,
            }),
        ).toHaveCount(0)
        await page.getByRole('button', { name: 'Language', exact: true }).click()
        await expect(page.locator('.route-heading h1')).toHaveText('往 中環')
        await expect(page.getByRole('combobox', { name: '路線班次', exact: true })).toHaveCount(0)
        await expect(page.locator('.stop-main')).toHaveCount(6)
    })
}
