import { navigateTab } from './navigation'
import { expect, type Page } from '@playwright/test'

export const stop = {
    id: 'KMB:ABC',
    code: 'ABC',
    provider: 'KMB',
    name: { en: 'Star Ferry', tc: '尖沙咀碼頭' },
    lat: 22.294,
    lng: 114.168,
}
export const route = {
    id: 'KMB:1A:O:1',
    number: '1A',
    provider: 'KMB',
    bound: 'O',
    service: '1',
    origin: { en: 'Sau Mau Ping', tc: '秀茂坪' },
    destination: { en: 'Star Ferry', tc: '尖沙咀碼頭' },
    stops: [{ id: stop.id, seq: 1 }],
}

export async function seed(page: Page, version = 2, fixture = { route, stop }, numbers?: string[]) {
    await page
        .context()
        .route('https://static.data.gov.hk/td/pt-headway-*/**', (request) => request.abort())
    await page.context().route('https://portal.csdi.gov.hk/**', (request) =>
        request.fulfill({
            json: {
                features: [{ attributes: { COMPANY_CODE: 'KMB+CTB', ROUTE_NAMEE: '106' } }],
            },
        }),
    )
    await page.addInitScript(
        ({ stop, route, version, numbers }) => {
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
                                    ? (numbers ?? [route.number, '2']).map((number) => ({
                                          ...route,
                                          number,
                                          id: `KMB:${number}:O:1`,
                                      }))
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
        { ...fixture, version, numbers },
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

export async function openStop(page: Page) {
    await navigateTab(page, 'Routes')
    await page.getByRole('button', { name: '1', exact: true }).click()
    await page.getByRole('button', { name: 'A', exact: true }).click()
    await expect(page.locator('.route-row')).toHaveCount(1)
    await page.locator('.route-row').click()
    await page.locator('.stop-main').click()
}
