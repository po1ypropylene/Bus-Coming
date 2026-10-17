// Real app captures inside a saved device template, using dated operator responses.
import { chromium, expect, webkit } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'

const fixture = JSON.parse(await readFile('scripts/fixtures/readme-transit.json', 'utf8'))
const origin = process.env.README_BASE_URL ?? 'http://127.0.0.1:4174'
const output = 'docs/images'
const templateDirectory = new URL('./templates/iphone/', import.meta.url)
const frameTemplate = await readFile(new URL('frame.html', templateDirectory), 'utf8')
const statusCss = await readFile(new URL('status-bar.css', templateDirectory), 'utf8')
const bezel = await readFile(new URL('bezel.png', templateDirectory))
const status = await readFile(new URL('ios-status-icons.svg', templateDirectory))

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
            viewport: { width: 393, height: 852 },
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
                viewport: { width: 511, height: 968 },
                deviceScaleFactor: 3,
            })
            const ink = scheme === 'light' ? '#17243a' : '#f0edf2'
            const time = new Date(fixture.capturedAt).toLocaleTimeString('en-GB', {
                timeZone: 'Asia/Hong_Kong',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            })
            const replacements = {
                STATUS_CSS: statusCss,
                INK: ink,
                FILTER: scheme === 'dark' ? 'invert(1)' : 'none',
                CAPTURE: `data:image/png;base64,${capture.toString('base64')}`,
                TIME: time,
                STATUS: `data:image/svg+xml;base64,${status.toString('base64')}`,
                BEZEL: `data:image/png;base64,${bezel.toString('base64')}`,
            }
            await frame.setContent(
                frameTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => replacements[key]),
            )
            await frame
                .locator('img')
                .evaluateAll((images) => Promise.all(images.map((img) => img.decode())))
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
