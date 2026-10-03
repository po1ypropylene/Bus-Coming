import { expect, test } from '@playwright/test'
import fixture from '../src/services/joint/fixtures/106.json' with { type: 'json' }

for (const joint of [false, true]) {
    test(`direction switch preserves ${joint ? 'joint partners' : 'Citybus identity for shared 2X number'}`, async ({
                                                                                                                        page,
                                                                                                                        context,
                                                                                                                    }) => {
        const routes = fixture.routes.map((route) =>
            joint
                ? route
                : {
                    ...route,
                    number: '2X',
                    id: route.id.replace('106', '2X'),
                    origin:
                        route.bound === 'O'
                            ? { en: 'Sai Wan Ho (Grand Promenade)', tc: '西灣河（嘉亨灣）' }
                            : { en: 'Exhibition Centre Station', tc: '會展站' },
                    destination:
                        route.bound === 'O'
                            ? { en: 'Exhibition Centre Station', tc: '會展站' }
                            : { en: 'Sai Wan Ho (Grand Promenade)', tc: '西灣河（嘉亨灣）' },
                },
        )
        const initial = routes.find((r) => r.provider === 'CTB' && r.bound === 'O')!
        const reverse = routes.find((r) => r.provider === 'CTB' && r.bound === 'I')!
        await context.route('https://portal.csdi.gov.hk/**', (req) => req.abort())
        const etaRequests: string[] = []
        await context.route('**/eta/**', (req) => {
            etaRequests.push(req.request().url())
            return req.fulfill({ json: { data: [] } })
        })
        await page.addInitScript(
            ({ routes, stops, initial, joint }) => {
                const link = initial.stops[1]
                localStorage.setItem(
                    'bus-coming-user-v1',
                    JSON.stringify({
                        version: 1,
                        theme: 'blue',
                        language: 'en',
                        bookmarks: [
                            {
                                id: 'legacy',
                                routeId: initial.id,
                                stopId: link.id,
                                seq: link.seq,
                                route: initial,
                                stop: stops[link.id as keyof typeof stops],
                                group: '',
                            },
                        ],
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
                    const tx = req.result.transaction(['snapshots', 'responses'], 'readwrite')
                    for (const provider of ['KMB', 'CTB', 'NLB'])
                        tx.objectStore('snapshots').put({
                            provider,
                            updatedAt: Date.now(),
                            routes: routes.filter((r) => r.provider === provider),
                            stops,
                            stopRoutes: {},
                        })
                    tx.objectStore('responses').put(
                        {
                            at: Date.now(),
                            generation: 1,
                            data: { updatedAt: Date.now(), numbers: joint ? ['106'] : ['102'] },
                        },
                        'td-joint-routes-v1',
                    )
                    tx.oncomplete = () => req.result.close()
                }
            },
            { routes, stops: fixture.stops, initial, joint },
        )
        await page.goto('/')
        await page.locator('.bookmark-route').click()
        await expect(page.locator('.route-heading h1')).toHaveText(initial.destination.en)
        await page
            .getByRole('button', {
                name: `Switch direction: ${reverse.destination.en}`,
                exact: true,
            })
            .click()
        await expect(page.locator('.route-heading h1')).toHaveText(reverse.destination.en)
        await expect(page.locator('.stop-row.expanded')).toHaveCount(0)
        await expect(page.locator('.route-heading .eyebrow')).toHaveText(
            joint ? 'KMB / LWB + Citybus · Joint route' : 'Citybus',
        )
        const stop = fixture.stops[reverse.stops[1].id as keyof typeof fixture.stops]
        await page.locator('.stop-main').filter({ hasText: stop.name.en }).first().click()
        await expect
            .poll(() =>
                etaRequests.some((url) => url.includes(`/CTB/${stop.code}/${reverse.number}`)),
            )
            .toBe(true)
        await page
            .getByRole('button', {
                name: `Switch direction: ${initial.destination.en}`,
                exact: true,
            })
            .click()
        await expect(page.locator('.route-heading h1')).toHaveText(initial.destination.en)
        await page.getByRole('button', { name: 'Language', exact: true }).click()
        await expect(
            page.getByRole('button', { name: `切換方向: ${reverse.destination.tc}`, exact: true }),
        ).toBeVisible()
    })
}
