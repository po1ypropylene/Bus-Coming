// Real app captures inside an illustrative device shell, using dated operator responses.
import { chromium, webkit, expect } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'

const fixture = JSON.parse(await readFile('scripts/fixtures/readme-transit.json', 'utf8'))
const origin = process.env.README_BASE_URL ?? 'http://127.0.0.1:4174'
const output = 'docs/images'
await mkdir(output, { recursive: true })
await mkdir('artifacts/readme', { recursive: true })
const snapshots = ['KMB', 'CTB', 'NLB'].map((provider) => {
    const routes = fixture.routes.filter((route) => route.provider === provider)
    const stops = Object.fromEntries(
        Object.entries(fixture.stops).filter(([, stop]) => stop.provider === provider),
    )
    const stopRoutes = {}
    for (const route of routes)
        for (const stop of route.stops)
            (stopRoutes[stop.id] ??= []).push({ routeId: route.id, seq: stop.seq })
    return { provider, updatedAt: Date.parse(fixture.capturedAt), routes, stops, stopRoutes }
})
const bookmarks = ['CTB:8P:O:1', 'KMB:118:I:1'].map((id) => {
    const route = fixture.routes.find((candidate) => candidate.id === id)
    const visit = route.stops[0]
    return {
        id: `${id}:${visit.id}:${visit.seq}`,
        routeId: id,
        stopId: visit.id,
        seq: visit.seq,
        group: '日常路線',
        route,
        stop: fixture.stops[visit.id],
    }
})
const appBrowser = await webkit.launch()
const frameBrowser = await chromium.launch()
try {
    for (const scheme of ['light', 'dark']) {
        const context = await appBrowser.newContext({
            viewport: { width: 402, height: 874 },
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
            locale: 'zh-HK',
            timezoneId: 'Asia/Hong_Kong',
            colorScheme: scheme,
            serviceWorkers: 'block',
        })
        const page = await context.newPage()
        await page.clock.setFixedTime(new Date(fixture.capturedAt))
        await page.route('**/src/styles/*.css', async (request) => {
            const response = await request.fetch()
            const body = (await response.text())
                .replaceAll('env(safe-area-inset-top)', '62px')
                .replaceAll('env(safe-area-inset-bottom)', '34px')
            await request.fulfill({ response, body })
        })
        await context.route(
            /^https:\/\/(data\.etabus\.gov\.hk|rt\.data\.gov\.hk|portal\.csdi\.gov\.hk)\//,
            (request) => {
                const url = request.request().url()
                const captured =
                    fixture.responses[url] ??
                    (url.includes('portal.csdi.gov.hk')
                        ? Object.entries(fixture.responses).find(([key]) =>
                              key.includes('portal.csdi.gov.hk'),
                          )?.[1]
                        : undefined)
                if (!captured) throw new Error(`Uncaptured API requested: ${url}`)
                return request.fulfill({ json: captured.json })
            },
        )
        // A new isolated browser context receives the documentation fixtures, never a user's storage.
        await page.goto(`${origin}/favicon.svg`)
        await page.evaluate(
            async ({ snapshots, bookmarks }) => {
                localStorage.setItem(
                    'bus-coming-user-v1',
                    JSON.stringify({ version: 1, language: 'tc', theme: 'blue', bookmarks }),
                )
                await new Promise((resolve, reject) => {
                    const request = indexedDB.open('bus-coming-v1', 2)
                    request.onupgradeneeded = () => {
                        for (const name of ['snapshots', 'routeCatalogs'])
                            request.result.createObjectStore(name, { keyPath: 'provider' })
                        request.result.createObjectStore('routeDetails', { keyPath: 'id' })
                        for (const name of ['responses', 'generations'])
                            request.result.createObjectStore(name)
                    }
                    request.onerror = () => reject(request.error)
                    request.onsuccess = () => {
                        const transaction = request.result.transaction('snapshots', 'readwrite')
                        snapshots.forEach((snapshot) =>
                            transaction.objectStore('snapshots').put(snapshot),
                        )
                        transaction.oncomplete = () => {
                            request.result.close()
                            resolve()
                        }
                        transaction.onerror = () => reject(transaction.error)
                    }
                })
            },
            { snapshots, bookmarks: [bookmarks[scheme === 'light' ? 0 : 1]] },
        )
        await page.goto(origin)
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'blue')
        await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant')
        if (scheme === 'dark') await expect(page.locator('.bookmark-bottom')).toContainText('聯營')
        await expect(page.locator('.arrival-skeleton')).toHaveCount(0)
        await expect(page.locator('.arrival-time')).not.toHaveCount(0)
        await expect(page.locator('.arrival-top button')).toHaveAttribute('aria-busy', 'false')
        await expect(page.locator('.arrival-panel.stale')).toHaveCount(0)
        for (const screen of ['saved', 'route']) {
            if (screen === 'route') {
                const number = scheme === 'light' ? '8P' : '118'
                await page.locator('.bookmark-route').filter({ hasText: number }).click()
                await expect(page.locator('.route-heading .route-badge')).toHaveText(number)
                await expect(page.locator('.arrival-skeleton')).toHaveCount(0)
                await expect(page.locator('.arrival-time')).not.toHaveCount(0)
                await expect(page.locator('.arrival-top button')).toHaveAttribute(
                    'aria-busy',
                    'false',
                )
                if (scheme === 'dark') {
                    // Show the complete 118 stop-list view; the saved preview shows its arrivals.
                    await page.locator('.stop-row.expanded .stop-main').click()
                }
            }
            await page.evaluate(
                () =>
                    new Promise((resolve) =>
                        requestAnimationFrame(() => requestAnimationFrame(resolve)),
                    ),
            )
            const capture = await page.screenshot({
                path: `artifacts/readme/${screen}-${scheme}.png`,
            })
            const frame = await frameBrowser.newPage({
                viewport: { width: 482, height: 954 },
                deviceScaleFactor: 3,
            })
            const ink = scheme === 'light' ? '#17243a' : '#f0edf2'
            const time = new Date(fixture.capturedAt).toLocaleTimeString('en-GB', {
                timeZone: 'Asia/Hong_Kong',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            })
            await frame.setContent(`<!doctype html><html><head><style>
                * { box-sizing: border-box }
                body { margin: 0; width: 482px; height: 954px; display: grid; place-items: center; background: transparent; font-family: -apple-system, BlinkMacSystemFont, sans-serif }
                .phone { position: relative; width: 428px; height: 900px; border-radius: 68px; background: linear-gradient(120deg,#7d838b,#25282d 25%,#666b73 55%,#181b20); padding: 13px; box-shadow: 0 12px 24px #14243b24, inset 0 0 0 1px #9197a0, inset 0 0 0 4px #353a42 }
                .screen { position: relative; width: 402px; height: 874px; overflow: hidden; border-radius: 55px; background: ${scheme === 'light' ? '#f6f8fc' : '#151e2b'}; box-shadow: 0 0 0 5px #08090c }
                .screen img { display: block; width: 402px; height: 874px }
                .island { position: absolute; top: 11px; left: 50%; transform: translateX(-50%); width: 124px; height: 35px; background: #020305; border-radius: 24px; box-shadow: inset 0 0 1px #45484d }
                .camera { position: absolute; right: 11px; top: 11px; width: 12px; height: 12px; border-radius: 50%; background: radial-gradient(circle at 40% 40%,#142c43,#06090e 55%); border: 2px solid #0c1018 }
                .time { position: absolute; top: 23px; left: 35px; font-size: 15px; font-weight: 650; color: ${ink} }
                .status { position: absolute; top: 24px; right: 28px; color: ${ink}; width: 66px; height: 14px }
                .home { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); width: 136px; height: 5px; border-radius: 8px; background: ${ink} }
                .key { position: absolute; width: 3px; border-radius: 2px; background: linear-gradient(#525861,#9298a0,#31363d) }
                .action { left: -2px; top: 115px; height: 25px }
                .volume-up { left: -2px; top: 163px; height: 54px }
                .volume-down { left: -2px; top: 231px; height: 54px }
                .power { right: -2px; top: 184px; height: 85px }
            </style></head><body><div class="phone">
                <i class="key action"></i><i class="key volume-up"></i><i class="key volume-down"></i><i class="key power"></i>
                <div class="screen"><img src="data:image/png;base64,${capture.toString('base64')}" alt="Bus Coming" />
                    <div class="time">${time}</div><div class="island"><i class="camera"></i></div>
                    <svg class="status" viewBox="0 0 66 14" fill="currentColor"><rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="8" rx="1"/><rect x="10" y="3" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="14" rx="1"/><path d="M23 4q7-6 14 0l-2 2q-5-4-10 0zm4 4q3-3 6 0l-3 4z"/><rect x="42" y="1" width="21" height="12" rx="3" fill="none" stroke="currentColor" opacity=".5"/><rect x="44" y="3" width="17" height="8" rx="1"/><rect x="64" y="5" width="2" height="4" rx="1"/></svg>
                    <div class="home"></div>
                </div></div></body></html>`)
            await frame.locator('img').evaluate((img) => img.decode())
            await frame.screenshot({
                path: `${output}/iphone17-${screen}-${scheme}.png`,
                omitBackground: true,
            })
            await frame.close()
        }
        await context.close()
    }
} finally {
    await appBrowser.close()
    await frameBrowser.close()
}
console.log('Rendered four Traditional Chinese, blue iPhone 17 previews to docs/images/.')
