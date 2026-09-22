import { expect, type Page, test } from '@playwright/test'

const stop = {
    id: 'KMB:ABC',
    code: 'ABC',
    provider: 'KMB',
    name: { en: 'Star Ferry', tc: '尖沙咀碼頭' },
    lat: 22.294,
    lng: 114.168,
}
const route = {
    id: 'KMB:1A:O:1',
    number: '1A',
    provider: 'KMB',
    bound: 'O',
    service: '1',
    origin: { en: 'Sau Mau Ping', tc: '秀茂坪' },
    destination: { en: 'Star Ferry', tc: '尖沙咀碼頭' },
    stops: [{ id: stop.id, seq: 1 }],
}
async function seed(page: Page, version = 2, fixture = { route, stop }) {
    await page.context().route('https://portal.csdi.gov.hk/**', (request) =>
        request.fulfill({
            json: {
                features: [{ attributes: { COMPANY_CODE: 'KMB+CTB', ROUTE_NAMEE: '106' } }],
            },
        }),
    )
    await page.addInitScript(
        ({ stop, route, version }) => {
            const req = indexedDB.open('bus-coming-v1', version)
            req.onupgradeneeded = () => {
                req.result.createObjectStore('snapshots', { keyPath: 'provider' })
                req.result.createObjectStore('responses')
                req.result.createObjectStore('generations')
                if (version >= 2) {
                    req.result.createObjectStore('routeCatalogs', { keyPath: 'provider' })
                    req.result.createObjectStore('routeDetails', { keyPath: 'id' })
                }
            }
            req.onsuccess = () => {
                const tx = req.result.transaction('snapshots', 'readwrite')
                for (const provider of ['KMB', 'CTB', 'NLB'])
                    tx.objectStore('snapshots').put({
                        provider,
                        updatedAt: Date.now(),
                        routes:
                            provider === route.provider
                                ? provider === 'KMB'
                                    ? [route, { ...route, id: 'KMB:2:O:1', number: '2' }]
                                    : [route]
                                : [],
                        stops: provider === route.provider ? { [stop.id]: stop } : {},
                        stopRoutes:
                            provider === route.provider
                                ? {
                                      [stop.id]: [
                                          { routeId: route.id, seq: 1 },
                                          ...(provider === 'KMB'
                                              ? [{ routeId: 'KMB:2:O:1', seq: 1 }]
                                              : []),
                                      ],
                                  }
                                : {},
                    })
                tx.oncomplete = () => req.result.close()
            }
        },
        { ...fixture, version },
    )
    await page.route('**/eta/**', (request) =>
        request.fulfill({
            json: {
                data: [
                    {
                        dir: 'O',
                        seq: 1,
                        service_type: 1,
                        eta: new Date(Date.now() + 5 * 60000).toISOString(),
                        rmk_en: '',
                        rmk_tc: '',
                    },
                    {
                        dir: 'I',
                        seq: 1,
                        service_type: 1,
                        eta: new Date(Date.now() + 60000).toISOString(),
                    },
                ],
            },
        }),
    )
    await page.goto('/')
}
async function openStop(page: Page) {
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await page.getByRole('button', { name: '1', exact: true }).click()
    await page.getByRole('button', { name: 'A', exact: true }).click()
    await expect(page.locator('.route-row')).toHaveCount(1)
    await page.locator('.route-row').click()
    await page.locator('.stop-main').click()
}
test('custom keypad, exact arrival filtering, grouped bookmarks, persistence and Chinese', async ({
    page,
}) => {
    await seed(page)
    await openStop(page)
    await expect(page.locator('.arrival-time')).toHaveCount(1)
    await page.getByRole('button', { name: 'Save stop', exact: true }).click()
    await page.getByLabel('Group (optional)').fill('To work')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.getByRole('button', { name: 'Saved', exact: true }).click()
    await expect(page.locator('.bookmark-card')).toHaveCount(1)
    await expect(page.locator('.bookmark-label')).toContainText('To work')
    await page.reload()
    await expect(page.locator('.bookmark-card')).toHaveCount(1)
    await page.getByRole('button', { name: 'Language', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant')
    await expect(page.locator('.bookmark-route')).toContainText('尖沙咀碼頭')
    await page.reload()
    await expect(page.getByRole('button', { name: '收藏', exact: true })).toBeVisible()
    await expect(page.locator('.bookmark-card')).toHaveCount(1)
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
})
test('GPS returns ordered nearby stops and routes', async ({ page, context, browserName }) => {
    if (browserName === 'webkit') {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'geolocation', {
                value: {
                    getCurrentPosition: (success: (position: unknown) => void) =>
                        success({
                            coords: { latitude: 22.2941, longitude: 114.168, accuracy: 12 },
                        }),
                },
            })
        })
    } else {
        await context.grantPermissions(['geolocation'])
        await context.setGeolocation({ latitude: 22.2941, longitude: 114.168 })
    }
    await seed(page)
    await page.getByRole('button', { name: 'Nearby', exact: true }).click()
    await page.getByRole('button', { name: 'Use my location', exact: true }).click()
    await expect(page.locator('.near-stop')).toHaveCount(1)
    await page.locator('.near-stop').click()
    await expect(page.locator('.near-routes .route-row')).toHaveCount(2)
    await page.locator('.near-routes .route-row').first().click()
    await expect(page.locator('.arrival-panel')).toBeVisible()
})
test('invalid backup does not overwrite bookmarks; valid backups merge', async ({ page }) => {
    await seed(page)
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.locator('input[type=file]').setInputFiles({
        name: 'bad.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{"version":1}'),
    })
    await expect(page.getByRole('status')).toContainText('could not be imported')
    const backup = {
        version: 1,
        language: 'en',
        bookmarks: [
            {
                id: 'KMB:1A:O:1:KMB:ABC:1',
                routeId: route.id,
                stopId: stop.id,
                seq: 1,
                group: 'Home',
                route,
                stop,
            },
        ],
    }
    await page.locator('input[type=file]').setInputFiles({
        name: 'backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(backup)),
    })
    await expect(page.getByRole('status')).toContainText('Backup imported')
    await page.getByRole('button', { name: 'Saved', exact: true }).click()
    await expect(page.locator('.bookmark-card')).toHaveCount(1)
})
test('offline ETA errors are explicit and saved route search remains usable', async ({
    page,
    context,
}) => {
    await seed(page)
    await page.unroute('**/eta/**')
    await page.route('**/eta/**', (req) => req.abort('internetdisconnected'))
    await openStop(page)
    await expect(page.locator('.arrival-panel')).toContainText('Could not update arrivals', {
        timeout: 15000,
    })
    await context.setOffline(true)
    await expect(page.locator('.banner')).toContainText('You’re offline')
    await page.getByRole('button', { name: 'Routes', exact: true }).last().click()
    await expect(page.locator('.route-row')).toHaveCount(1)
})
test('empty, keypad, settings and dark mobile layouts have no horizontal overflow', async ({
    page,
}) => {
    await seed(page)
    await expect(page.getByRole('heading', { name: 'Good journeys start here.' })).toBeVisible()
    await page.screenshot({
        path: `test-results/home-${test.info().project.name}.png`,
        fullPage: true,
    })
    for (const name of ['Routes', 'Nearby', 'Settings']) {
        await page.getByRole('button', { name, exact: true }).click()
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true)
    }
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.screenshot({
        path: `test-results/settings-dark-${test.info().project.name}.png`,
        fullPage: true,
    })
})
test('first launch normalizes all operators and handles missing upstream stop metadata', async ({
    page,
}) => {
    await page.route('https://data.etabus.gov.hk/**', (req) => {
        const path = new URL(req.request().url()).pathname
        const data = path.endsWith('/route/')
            ? [
                  {
                      route: '1',
                      bound: 'O',
                      service_type: '1',
                      orig_en: 'Origin',
                      orig_tc: '起點',
                      dest_en: 'End',
                      dest_tc: '終點',
                  },
              ]
            : path.endsWith('/route-stop')
              ? [
                    { route: '1', bound: 'O', service_type: '1', seq: '1', stop: 'MISSING' },
                    { route: '1', bound: 'O', service_type: '1', seq: '2', stop: 'ABC' },
                ]
              : path.endsWith('/stop')
                ? [
                      {
                          stop: 'ABC',
                          name_en: 'Known stop',
                          name_tc: '已知車站',
                          lat: '22.3',
                          long: '114.2',
                      },
                  ]
                : {}
        return req.fulfill({ json: { data }, headers: { 'access-control-allow-origin': '*' } })
    })
    await page.route('https://rt.data.gov.hk/**', (req) => {
        const url = new URL(req.request().url())
        const data = url.pathname.endsWith('/route/CTB')
            ? {
                  data: [
                      {
                          route: '10',
                          orig_en: 'Origin',
                          orig_tc: '起點',
                          dest_en: 'End',
                          dest_tc: '終點',
                      },
                  ],
              }
            : url.pathname.includes('/route-stop/')
              ? { data: [{ stop: '000001', seq: 1 }] }
              : url.pathname.includes('/citybus/stop/')
                ? {
                      data: {
                          stop: '000001',
                          name_en: 'Citybus stop',
                          name_tc: '城巴車站',
                          lat: 22.3,
                          long: 114.2,
                      },
                  }
                : url.pathname.endsWith('/route.php')
                  ? {
                        routes: [
                            {
                                routeId: '1',
                                routeNo: '1X',
                                routeName_e: 'Origin > End',
                                routeName_c: '起點 > 終點',
                            },
                        ],
                    }
                  : {
                        stops: [
                            {
                                stopId: '1',
                                stopName_e: 'NLB stop',
                                stopName_c: '嶼巴車站',
                                latitude: '22.2',
                                longitude: '113.9',
                            },
                        ],
                    }
        return req.fulfill({ json: data, headers: { 'access-control-allow-origin': '*' } })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByText('Ready offline', { exact: true })).toHaveCount(3, {
        timeout: 15000,
    })
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await expect(page.locator('.route-row')).toHaveCount(4)
    await page.locator('.route-row').first().click()
    await expect(page.locator('.stop-list')).toContainText('Stop details unavailable')
    await expect(page.locator('.stop-main')).toHaveCount(2)
})
test('failed forced refresh keeps old snapshots and user bookmarks intact', async ({ page }) => {
    await seed(page)
    await page.route('https://data.etabus.gov.hk/**', (req) =>
        req.fulfill({ status: 503, body: 'Unavailable' }),
    )
    await page.route('https://rt.data.gov.hk/**', (req) =>
        req.fulfill({ status: 503, body: 'Unavailable' }),
    )
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: 'Refresh route data', exact: true }).click()
    await expect(
        page.getByText('Download interrupted. Tap refresh to resume.', { exact: true }),
    ).toHaveCount(3, { timeout: 25000 })
    await expect(page.getByText('Ready offline', { exact: true })).toHaveCount(3)
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await expect(page.locator('.route-row')).toHaveCount(2)
})

test('Citybus is searchable and usable before its full offline download finishes', async ({
    page,
}) => {
    // The second route fails, deliberately preventing a complete Citybus snapshot.
    await page.route('https://data.etabus.gov.hk/**', (req) =>
        req.fulfill({ status: 503, body: 'Unavailable' }),
    )
    await page.route('https://rt.data.gov.hk/**', (req) => {
        const url = new URL(req.request().url())
        if (url.pathname.includes('/nlb/') || url.pathname.includes('/99/'))
            return req.fulfill({ status: 503, body: 'Unavailable' })
        const data = url.pathname.endsWith('/route/CTB')
            ? {
                  data: [
                      {
                          route: '2X',
                          orig_en: 'Central',
                          orig_tc: '中環',
                          dest_en: 'Star Ferry',
                          dest_tc: '尖沙咀碼頭',
                      },
                      {
                          route: '99',
                          orig_en: 'Other origin',
                          orig_tc: '其他起點',
                          dest_en: 'Other destination',
                          dest_tc: '其他終點',
                      },
                  ],
              }
            : url.pathname.includes('/route-stop/')
              ? { data: [{ stop: '000001', seq: 1 }] }
              : url.pathname.includes('/eta/')
                ? { data: [{ dir: 'O', seq: 1, eta: new Date(Date.now() + 300000).toISOString() }] }
                : {
                      data: {
                          stop: '000001',
                          name_en: 'Citybus stop',
                          name_tc: '城巴車站',
                          lat: 22.3,
                          long: 114.2,
                      },
                  }
        return req.fulfill({ json: data, headers: { 'access-control-allow-origin': '*' } })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await page.getByRole('button', { name: 'Citybus', exact: true }).click()
    await page.getByRole('textbox', { name: 'Route number' }).fill('2X')
    await expect(page.locator('.route-row')).toHaveCount(2)
    await expect(page.locator('.catalog-status')).toContainText('Citybus routes are searchable')
    await page
        .getByRole('button', { name: '2X Citybus Star Ferry From Central', exact: true })
        .click()
    await expect(page.locator('.stop-main')).toHaveCount(1)
    await page.locator('.stop-main').click()
    await expect(page.locator('.arrival-time')).toHaveCount(1)
    await page.getByRole('button', { name: 'Save stop', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.getByRole('button', { name: 'Saved', exact: true }).click()
    await expect(page.locator('.bookmark-card')).toHaveCount(1)
    // A refresh/reload must keep the published index and cached selected route.
    await page.reload()
    await expect(page.locator('.bookmark-card')).toHaveCount(1)
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await page.getByRole('button', { name: 'Citybus', exact: true }).click()
    await page.getByRole('textbox', { name: 'Route number' }).fill('2X')
    await expect(page.locator('.route-row')).toHaveCount(2)
    await page
        .getByRole('button', { name: '2X Citybus Star Ferry From Central', exact: true })
        .click()
    await expect(page.locator('.stop-main')).toHaveCount(1)
})

test('database upgrade preserves version-one snapshots and bookmarks', async ({ page }) => {
    await page.addInitScript(
        ({ route, stop }) => {
            localStorage.setItem(
                'bus-coming-user-v1',
                JSON.stringify({
                    version: 1,
                    language: 'en',
                    bookmarks: [
                        {
                            id: 'existing',
                            routeId: route.id,
                            stopId: stop.id,
                            seq: 1,
                            group: 'Home',
                            route,
                            stop,
                        },
                    ],
                }),
            )
        },
        { route, stop },
    )
    await seed(page, 1)
    await expect(page.locator('.bookmark-card')).toHaveCount(1)
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await expect(page.locator('.route-row')).toHaveCount(2)
    const schema = await page.evaluate(
        () =>
            new Promise<{ version: number; stores: string[] }>((resolve, reject) => {
                const req = indexedDB.open('bus-coming-v1')
                req.onerror = () => reject(req.error)
                req.onsuccess = () => {
                    resolve({
                        version: req.result.version,
                        stores: [...req.result.objectStoreNames],
                    })
                    req.result.close()
                }
            }),
    )
    expect(schema.version).toBe(2)
    expect(schema.stores).toEqual(
        expect.arrayContaining([
            'snapshots',
            'responses',
            'generations',
            'routeCatalogs',
            'routeDetails',
        ]),
    )
})

test('theme colours persist, support both appearances and survive backup import', async ({
    page,
}) => {
    await seed(page)
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Green', exact: true })).toBeChecked()
    const colours = new Set<string>()
    for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme })
        for (const colour of ['Blue', 'Green', 'Yellow', 'Red', 'Purple']) {
            await page.getByRole('radio', { name: colour, exact: true }).check()
            await expect(page.locator('html')).toHaveAttribute('data-theme', colour.toLowerCase())
            const tokens = await page.evaluate(() => {
                const style = getComputedStyle(document.documentElement)
                return {
                    accent: style.getPropertyValue('--accent').trim(),
                    bg: style.getPropertyValue('--bg').trim(),
                    surface: style.getPropertyValue('--surface').trim(),
                }
            })
            colours.add(tokens.accent)
            await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
                'content',
                tokens.bg,
            )
            const luminance = (hex: string) => {
                const full =
                    hex.length === 4 ? '#' + [...hex.slice(1)].map((c) => c + c).join('') : hex
                const rgb = [1, 3, 5]
                    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
                    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
                return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
            }
            const a = luminance(tokens.accent),
                b = luminance(tokens.surface)
            expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThan(4.5)
        }
    }
    expect(colours.size).toBe(10)
    await page.reload()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Purple', exact: true })).toBeChecked()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export bookmarks', exact: true }).click()
    const download = await downloadPromise
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
    const backup = JSON.parse(Buffer.concat(chunks).toString())
    expect(backup.theme).toBe('purple')
    await page.getByRole('radio', { name: 'Blue', exact: true }).check()
    await page.locator('input[type=file]').setInputFiles({
        name: 'theme.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(backup)),
    })
    await expect(page.getByRole('radio', { name: 'Purple', exact: true })).toBeChecked()
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('tc')
    await expect(page.getByRole('group', { name: '主題顏色' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '紫色', exact: true })).toBeChecked()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({
        path: `test-results/theme-${test.info().project.name}.png`,
        fullPage: true,
    })
})

test('N8P inbound offset sequences display ETAs in route details and saved stops', async ({
    page,
}) => {
    const inbound = {
        ...route,
        id: 'CTB:N8P:I:1',
        provider: 'CTB',
        number: 'N8P',
        bound: 'I',
        origin: { en: 'Wan Chai (Harbour Road)', tc: '灣仔 (港灣道)' },
        destination: { en: 'Siu Sai Wan (Island Resort)', tc: '小西灣 (藍灣半島)' },
        stops: [{ id: 'CTB:002424', seq: 1 }],
    }
    const cityStop = {
        ...stop,
        id: 'CTB:002424',
        code: '002424',
        provider: 'CTB',
        name: inbound.origin,
    }
    await seed(page, 2, { route: inbound, stop: cityStop })
    await page.route('**/eta/CTB/002424/N8P', (req) =>
        req.fulfill({
            json: {
                data: [
                    {
                        co: 'CTB',
                        route: 'N8P',
                        stop: '002424',
                        dir: 'I',
                        seq: 12,
                        eta: new Date(Date.now() + 300000).toISOString(),
                        rmk_en: 'Inbound service',
                    },
                    {
                        co: 'CTB',
                        route: 'N8P',
                        stop: '002424',
                        dir: 'O',
                        seq: 1,
                        eta: new Date(Date.now() + 600000).toISOString(),
                        rmk_en: 'Wrong direction',
                    },
                ],
            },
        }),
    )
    await page.reload()
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await page.getByRole('textbox', { name: 'Route number' }).fill('N8P')
    await page.locator('.route-row').click()
    await page.locator('.stop-main').click()
    await expect(page.locator('.arrival-time')).toHaveCount(1)
    await expect(page.locator('.arrival-panel')).toContainText('Inbound service')
    await expect(page.locator('.arrival-panel')).not.toContainText('Wrong direction')
    await page.getByRole('button', { name: 'Save stop', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.getByRole('button', { name: 'Saved', exact: true }).click()
    await expect(page.locator('.arrival-time')).toHaveCount(1)
    await page.reload()
    await expect(page.locator('.arrival-time')).toHaveCount(1)
})

test('mobile route matches remain visible above the keypad while typing', async ({ page }) => {
    await seed(page)
    for (const viewport of [
        { width: 440, height: 956 },
        { width: 320, height: 568 },
    ]) {
        await page.setViewportSize(viewport)
        await page.getByRole('button', { name: 'Routes', exact: true }).click()
        await page.getByRole('button', { name: 'Clear', exact: true }).last().click()
        await page.getByRole('button', { name: '1', exact: true }).click()
        await page.getByRole('button', { name: 'A', exact: true }).click()
        await expect(page.locator('.route-row')).toHaveCount(1)
        const result = await page.locator('.route-row').boundingBox()
        const keypad = await page.locator('.keypad').boundingBox()
        expect(result!.y).toBeGreaterThan(0)
        expect(result!.y + result!.height).toBeLessThanOrEqual(keypad!.y)
        expect(keypad!.y + keypad!.height).toBeLessThan(viewport.height)
        expect(await page.evaluate(() => window.scrollY)).toBe(0)
        const before = await page.locator('.search-results').boundingBox()
        await page.getByRole('button', { name: 'Hide keypad', exact: true }).click()
        const after = await page.locator('.search-results').boundingBox()
        expect(after!.height).toBeGreaterThan(before!.height)
        await page.getByRole('button', { name: 'Show keypad', exact: true }).click()
    }
    await page.setViewportSize({ width: 440, height: 956 })
    await page.screenshot({ path: `test-results/route-keypad-${test.info().project.name}.png` })
    await page.locator('.route-row').click()
    await expect(page.locator('.stop-main')).toBeVisible()
    await expect(page.locator('.route-search-shell')).toHaveCount(0)
})

test('bookmarks reorder within groups, persist on reload and support keyboard and Chinese', async ({
                                                                                                       page,
                                                                                                   }) => {
    await seed(page)
    await page.evaluate(
        ({ route, stop }) => {
            localStorage.setItem(
                'bus-coming-user-v1',
                JSON.stringify({
                    version: 1,
                    language: 'en',
                    theme: 'blue',
                    bookmarks: ['a', 'b', 'c'].map((id, index) => ({
                        id,
                        routeId: route.id,
                        stopId: stop.id,
                        seq: 1,
                        route,
                        stop: { ...stop, name: { en: `Saved ${id}`, tc: `收藏${id}` } },
                        group: index === 1 ? 'Home' : 'Work',
                    })),
                }),
            )
        },
        { route, stop },
    )
    await page.reload()
    await page.getByRole('button', { name: 'Work', exact: true }).click()
    await page.getByRole('button', { name: 'Reorder', exact: true }).click()
    const labels = () => page.locator('.bookmark-order-copy strong').allTextContents()
    await expect(page.locator('.bookmark-order-list li')).toHaveCount(2)
    await expect(page.getByRole('button', { name: /^Move up:.*Saved a/ })).toBeDisabled()
    await page.getByRole('button', { name: /^Move up:.*Saved c/ }).click()
    expect(await labels()).toEqual(['1A · Saved c', '1A · Saved a'])
    const readOrder = () =>
        page.evaluate(() =>
            JSON.parse(localStorage.getItem('bus-coming-user-v1')!).bookmarks.map(
                (b: { id: string }) => b.id,
            ),
        )
    expect(await readOrder()).toEqual(['c', 'b', 'a'])
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.reload()
    await page.getByRole('button', { name: 'Reorder', exact: true }).click()
    expect(await labels()).toEqual(['1A · Saved c', '1A · Saved b', '1A · Saved a'])
    const up = page.getByRole('button', { name: /^Move up:.*Saved b/ })
    await up.focus()
    await page.keyboard.press('Enter')
    expect(await readOrder()).toEqual(['b', 'c', 'a'])
    await page.getByRole('button', { name: 'Language', exact: true }).click()
    await expect(page.getByRole('button', { name: /^向下移動/ }).first()).toBeVisible()
    await expect(page.getByText('使用箭頭調整收藏車站的次序，變更會自動儲存。')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('Citybus rush-hour ETA order is chronological in route details and saved bookmarks', async ({
                                                                                                     page,
                                                                                                 }) => {
    // Reproduce the reported response ordering without relying on a live rush-hour window.
    const fixtureStop = {
        ...stop,
        id: 'CTB:720TEST',
        code: '720TEST',
        provider: 'CTB',
        name: { en: 'Tung Hiu House Tung Yuk Court', tc: '東旭苑東曉閣' },
    }
    const fixtureRoute = {
        ...route,
        id: 'CTB:720:I:1',
        number: '720',
        provider: 'CTB',
        bound: 'I',
        destination: { en: 'Central', tc: '中環' },
        stops: [{ id: fixtureStop.id, seq: 2 }],
    }
    await seed(page, 2, { route: fixtureRoute, stop: fixtureStop })
    await page.route('**/eta/**', (request) =>
        request.fulfill({
            json: {
                data: [13, 2, 7].map((minutes) => ({
                    dir: 'I',
                    seq: 2,
                    eta: new Date(Date.now() + minutes * 60000).toISOString(),
                    rmk_en: `Variant ${minutes}`,
                })),
            },
        }),
    )
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await page.locator('.route-row').click()
    await page.locator('.stop-main').click()
    await expect(page.locator('.arrival-time strong')).toHaveText(['2', '7', '13'])
    await page.getByRole('button', { name: 'Save stop', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.getByRole('button', { name: 'Saved', exact: true }).click()
    await expect(page.locator('.arrival-time strong')).toHaveText(['2', '7', '13'])
})
