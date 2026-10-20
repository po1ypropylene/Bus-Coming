import { test, expect } from './test'
import twoX from '../src/services/variants/fixtures/2x.json' with { type: 'json' }
import td102 from '../src/services/variants/fixtures/102.json' with { type: 'json' }
import joint102 from '../src/services/joint/fixtures/102.json' with { type: 'json' }
import { matchJointStops } from '../src/services/joint/matching'
import type { Route, Stop } from '../src/types/transit'

for (const number of ['2X', '102']) {
    for (const bound of ['O', 'I'] as const) {
        test(`${number} ${bound} preserves operator stops and arrivals with a loaded timetable`, async ({
            page,
            context,
        }) => {
            const source = number === '2X' ? twoX.operator : joint102
            const routes = source.routes as Route[]
            const stops = source.stops as Record<string, Stop>
            const route = routes.find((r) => r.provider === 'CTB' && r.bound === bound)!
            const partner = routes.find((r) => r.provider === 'KMB' && r.bound === bound)
            const pairs = partner ? matchJointStops(route, partner, stops) : []
            const link = pairs[0]?.a ?? route.stops[0]
            const expectedCount =
                route.stops.length + (partner ? partner.stops.length - pairs.length : 0)
            await context.route('https://portal.csdi.gov.hk/**', (req) => req.abort())
            await context.route('**/eta/**', (req) => {
                const url = req.request().url()
                const provider = url.includes('/CTB/') ? 'CTB' : 'KMB'
                const rows = routes
                    .filter((r) => r.provider === provider)
                    .flatMap((r) =>
                        r.stops
                            .filter((s) => url.includes(stops[s.id].code))
                            .map((s) => ({
                                co: provider,
                                route: number,
                                dir: r.bound,
                                seq: s.seq,
                                stop: stops[s.id].code,
                                service_type: 1,
                                eta: new Date(
                                    Date.now() + (provider === 'CTB' ? 5 : 10) * 60000,
                                ).toISOString(),
                            })),
                    )
                return req.fulfill({ json: { data: rows } })
            })
            await page.addInitScript(
                ({ routes, stops, route, link, catalog, number }) => {
                    localStorage.setItem(
                        'bus-coming-user-v1',
                        JSON.stringify({
                            version: 1,
                            theme: 'blue',
                            language: 'en',
                            bookmarks: [
                                {
                                    id: 'legacy-citybus',
                                    routeId: route.id,
                                    route,
                                    stopId: link.id,
                                    stop: stops[link.id],
                                    seq: link.seq,
                                    group: 'Work',
                                },
                            ],
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
                        const tx = request.result.transaction(
                            ['snapshots', 'responses'],
                            'readwrite',
                        )
                        for (const provider of ['KMB', 'CTB', 'NLB'])
                            tx.objectStore('snapshots').put({
                                provider,
                                updatedAt: Date.now(),
                                routes: routes.filter((r) => r.provider === provider),
                                stops: Object.fromEntries(
                                    Object.entries(stops).filter(
                                        ([, s]) => s.provider === provider,
                                    ),
                                ),
                                stopRoutes: {},
                            })
                        for (const [key, data] of [
                            ['td-citybus-variants-v1', { ...catalog, updatedAt: Date.now() }],
                            [
                                'td-joint-routes-v1',
                                {
                                    updatedAt: Date.now(),
                                    numbers: number === '102' ? ['102'] : ['106'],
                                },
                            ],
                        ] as const)
                            tx.objectStore('responses').put(
                                { at: Date.now(), generation: 1, data },
                                key,
                            )
                        tx.oncomplete = () => request.result.close()
                    }
                },
                {
                    routes,
                    stops,
                    route,
                    link,
                    catalog: number === '2X' ? twoX.catalog : td102.catalog,
                    number,
                },
            )
            await page.goto('/')
            await page.locator('.bookmark-route').click()
            await expect(page.locator('.route-heading h1')).toHaveText(`To ${route.destination.en}`)
            await expect(page.locator('.stop-main')).toHaveCount(expectedCount)
            await expect(page.locator('.variant-picker')).toHaveCount(0)
            await expect(page.locator('.variant-name')).toHaveCount(0)
            const shown = await page.locator('.stop-main strong').allTextContents()
            for (const { id } of route.stops) expect(shown).toContain(stops[id].name.en)
            if (partner) {
                for (const { id } of partner.stops.filter(
                    (s) => !pairs.some((p) => p.b.id === s.id),
                ))
                    expect(shown).toContain(stops[id].name.en)
                await expect(page.locator('.arrival-time')).toHaveCount(2)
                await expect(page.locator('.route-heading .eyebrow')).toContainText('Joint route')
            } else await expect(page.locator('.arrival-time')).toHaveCount(1)
            expect(
                await page.evaluate(
                    () =>
                        JSON.parse(localStorage.getItem('bus-coming-user-v1')!).bookmarks[0]
                            .routeId,
                ),
            ).toBe(route.id)
            await page.getByRole('button', { name: 'Switch direction', exact: false }).click()
            const reverse = routes.find((r) => r.provider === 'CTB' && r.bound !== bound)!
            await expect(page.locator('.route-heading h1')).toHaveText(
                `To ${reverse.destination.en}`,
            )
            await expect(page.locator('.variant-picker')).toHaveCount(0)
        })
    }
}
