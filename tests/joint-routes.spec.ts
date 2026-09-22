import { expect, test } from '@playwright/test'
import type { Bookmark, Route, Snapshot, Stop } from '../src/types/transit'

const kmb: Route = {
    id: 'KMB:106:O:1',
    number: '106',
    provider: 'KMB',
    bound: 'O',
    service: '1',
    origin: { en: 'Wong Tai Sin', tc: '黃大仙' },
    destination: { en: 'Siu Sai Wan', tc: '小西灣' },
    stops: [1, 2, 3].map((seq) => ({ id: `KMB:${seq}`, seq })),
}
const ctb: Route = {
    ...kmb,
    id: 'CTB:106:I:1',
    provider: 'CTB',
    bound: 'I',
    stops: [1, 2, 3].map((seq) => ({ id: `CTB:${seq}`, seq: seq + 10 })),
}
const stops: Record<string, Stop> = Object.fromEntries(
    [kmb, ctb].flatMap((r) =>
        r.stops.map((s, i) => [
            s.id,
            {
                id: s.id,
                code: s.id.slice(4),
                provider: r.provider,
                name: { en: `Stop ${i + 1}`, tc: `車站${i + 1}` },
                lat: 22.3 + i * 0.003,
                lng: 114.17,
            },
        ]),
    ),
)
const extra: Stop = {
    ...stops['CTB:2'],
    id: 'CTB:extra',
    code: 'extra',
    name: { en: 'Citybus-only stop', tc: '城巴獨有車站' },
    lat: 22.3045,
}
const partner = {
    ...ctb,
    stops: [...ctb.stops.slice(0, 2), { id: extra.id, seq: 13 }, { ...ctb.stops[2], seq: 14 }],
}
const bookmark: Bookmark = {
    id: 'old-citybus',
    routeId: partner.id,
    route: partner,
    stopId: 'CTB:2',
    stop: stops['CTB:2'],
    seq: 12,
    group: 'Work',
}
const snapshots: Snapshot[] = (['KMB', 'CTB', 'NLB'] as const).map((provider) => {
    const route = provider === 'KMB' ? kmb : partner
    return {
        provider,
        updatedAt: Date.now(),
        routes:
            provider === 'NLB' ? [] : [route, { ...route, id: `${provider}:2X:O:1`, number: '2X' }],
        stops: provider === 'NLB' ? {} : { ...stops, [extra.id]: extra },
        stopRoutes: {},
    }
})

test('official joint data merges listings, combines ETAs, includes extra stops and preserves old bookmarks', async ({
    page,
    context,
}) => {
    await context.route('https://portal.csdi.gov.hk/**', (request) =>
        request.fulfill({
            json: { features: [{ attributes: { COMPANY_CODE: 'KMB+CTB', ROUTE_NAMEE: '106' } }] },
        }),
    )
    await context.route('**/eta/**', (request) =>
        request.fulfill({
            json: {
                data: [
                    {
                        dir: request.request().url().includes('/CTB/') ? 'I' : 'O',
                        seq: request.request().url().includes('/CTB/') ? 12 : 2,
                        service_type: 1,
                        eta: new Date(
                            Date.now() +
                                (request.request().url().includes('/CTB/') ? 3 : 7) * 60000,
                        ).toISOString(),
                    },
                ],
            },
        }),
    )
    await page.addInitScript(
        ({ snapshots, bookmark }) => {
            if (!localStorage.getItem('bus-coming-user-v1'))
                localStorage.setItem(
                    'bus-coming-user-v1',
                    JSON.stringify({
                        version: 1,
                        language: 'en',
                        theme: 'blue',
                        bookmarks: [bookmark],
                    }),
                )
            const req = indexedDB.open('bus-coming-v1', 2)
            req.onupgradeneeded = () => {
                req.result.createObjectStore('snapshots', { keyPath: 'provider' })
                req.result.createObjectStore('responses')
                req.result.createObjectStore('generations')
                req.result.createObjectStore('routeCatalogs', { keyPath: 'provider' })
                req.result.createObjectStore('routeDetails', { keyPath: 'id' })
            }
            req.onsuccess = () => {
                const tx = req.result.transaction('snapshots', 'readwrite')
                snapshots.forEach((s) =>
                    tx.objectStore('snapshots').put({ ...s, updatedAt: Date.now() }),
                )
                tx.oncomplete = () => req.result.close()
            }
        },
        { snapshots, bookmark },
    )
    await page.goto('/')
    await expect(page.locator('.bookmark-bottom')).toContainText('Joint route')
    await expect(page.locator('.arrival-time')).toHaveCount(2)
    await expect(page.locator('.arrival-time').first()).toContainText('Citybus')
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    for (const key of ['1', '0', '6'])
        await page.getByRole('button', { name: key, exact: true }).click()
    await expect(page.locator('.route-row')).toHaveCount(1)
    await expect(page.locator('.route-row')).toContainText('Joint route')
    await page.getByRole('button', { name: 'Citybus', exact: true }).click()
    await expect(page.locator('.route-row')).toHaveCount(1)
    await page.locator('.route-row').click()
    await expect(page.locator('.stop-main')).toHaveCount(4)
    await page.locator('.stop-main').filter({ hasText: 'Stop 2' }).click()
    await expect(page.locator('.arrival-time')).toHaveCount(2)
    await expect(page.locator('.arrival-time').first()).toContainText('Citybus')
    await page.screenshot({
        path: `test-results/joint-route-${test.info().project.name}.png`,
        fullPage: true,
    })
    await page.getByRole('button', { name: 'Save stop', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.reload()
    await expect(page.locator('.bookmark-card')).toHaveCount(2)
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bus-coming-user-v1')!))
    expect(saved.theme).toBe('blue')
    expect(saved.bookmarks[0].routeId).toBe(partner.id)
    expect(saved.bookmarks[1].route.jointPartners).toBeUndefined()
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    for (const key of ['2', 'X']) await page.getByRole('button', { name: key, exact: true }).click()
    await expect(page.locator('.route-row')).toHaveCount(2)
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByText('Joint routes · Transport Department')).toBeVisible()
    await page.getByRole('combobox', { name: 'Language' }).selectOption('tc')
    await expect(page.getByText('聯營路線 · 運輸署')).toBeVisible()
})
