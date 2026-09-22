import { chromium, webkit } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve } from 'node:path'

await mkdir('artifacts', { recursive: true })
const results = []
for (const [name, engine] of [
    ['Chromium', chromium],
    ['WebKit', webkit],
]) {
    const server = createServer(async (req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname
        const file = resolve('dist', pathname === '/' ? 'index.html' : '.' + pathname)
        if (!file.startsWith(resolve('dist') + '/')) {
            res.writeHead(403).end()
            return
        }
        try {
            const data = await readFile(file)
            const mime = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.png': 'image/png',
                '.svg': 'image/svg+xml',
                '.webmanifest': 'application/manifest+json',
            }
            res.writeHead(200, {
                'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
            })
            res.end(data)
        } catch {
            res.writeHead(404).end()
        }
    })
    await new Promise((resolve) => server.listen(4181, '127.0.0.1', resolve))
    const browser = await engine.launch()
    try {
        const context = await browser.newContext({
            viewport: { width: 440, height: 956 },
            isMobile: true,
            hasTouch: true,
        })
        await context.route('https://data.etabus.gov.hk/**', (req) => req.abort())
        await context.route('https://rt.data.gov.hk/**', (req) => req.abort())
        await context.route('https://portal.csdi.gov.hk/**', (req) => req.abort())
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('http://127.0.0.1:4181')
        await page.evaluate(() => navigator.serviceWorker.ready)
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
        await page.evaluate(async () => {
            const stop = {
                id: 'KMB:ABC',
                code: 'ABC',
                provider: 'KMB',
                name: { en: 'Offline stop', tc: '離線車站' },
                lat: 22.3,
                lng: 114.2,
            }
            const route = {
                id: 'KMB:106:O:1',
                number: '106',
                provider: 'KMB',
                bound: 'O',
                service: '1',
                origin: { en: 'Origin', tc: '起點' },
                destination: { en: 'Destination', tc: '終點' },
                stops: [{ id: stop.id, seq: 1 }],
            }
            const partnerStop = { ...stop, id: 'CTB:000001', code: '000001', provider: 'CTB' }
            const partner = {
                ...route,
                id: 'CTB:106:I:1',
                provider: 'CTB',
                bound: 'I',
                stops: [{ id: partnerStop.id, seq: 12 }],
            }
            localStorage.setItem(
                'bus-coming-user-v1',
                JSON.stringify({
                    version: 1,
                    language: 'en',
                    bookmarks: [
                        {
                            id: 'saved',
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
            await new Promise((resolve, reject) => {
                const req = indexedDB.open('bus-coming-v1', 2)
                req.onerror = () => reject(req.error)
                req.onsuccess = () => {
                    const tx = req.result.transaction(['snapshots', 'responses'], 'readwrite')
                    tx.objectStore('responses').put(
                        {
                            at: Date.now(),
                            generation: 1,
                            data: { updatedAt: Date.now(), numbers: ['106'] },
                        },
                        'td-joint-routes-v1',
                    )
                    for (const provider of ['KMB', 'CTB', 'NLB'])
                        tx.objectStore('snapshots').put({
                            provider,
                            updatedAt: Date.now(),
                            routes:
                                provider === 'KMB' ? [route] : provider === 'CTB' ? [partner] : [],
                            stops:
                                provider === 'KMB'
                                    ? { [stop.id]: stop }
                                    : provider === 'CTB'
                                      ? { [partnerStop.id]: partnerStop }
                                      : {},
                            stopRoutes: {},
                        })
                    tx.oncomplete = () => {
                        req.result.close()
                        resolve(true)
                    }
                }
            })
        })
        // Stop the actual origin for both engines. WebKit's emulated offline switch
        // fails navigations internally on this runtime even with a populated cache.
        server.closeAllConnections()
        await new Promise((resolve) => server.close(resolve))
        if (name === 'Chromium') await context.setOffline(true)
        console.log(
            name,
            'cache ready',
            await page.evaluate(async () => ({
                keys: await caches.keys(),
                indexCached: !!(await caches.match('/index.html', { ignoreSearch: true })),
            })),
        )
        try {
            await page.reload({ waitUntil: 'domcontentloaded' })
        } catch (error) {
            console.log(name, 'reload error:', error.message)
            await page.screenshot({ path: `artifacts/offline-error-${name}.png` })
            throw error
        }
        await page.locator('.bookmark-card').waitFor()
        await page.getByRole('button', { name: 'Routes', exact: true }).click()
        await page.locator('.route-row').waitFor()
        if (
            (await page.locator('.route-row').count()) !== 1 ||
            !(await page.locator('.route-row').textContent()).includes('Joint route')
        )
            throw new Error('Offline joint membership was not restored')
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
        )
        const manifest = await page.evaluate(async () =>
            (await fetch('/manifest.webmanifest')).json(),
        )
        if (manifest.display !== 'standalone' || overflow || errors.length)
            throw new Error(JSON.stringify({ manifest, overflow, errors }))
        await page.screenshot({
            path: `artifacts/offline-${name.toLowerCase()}.png`,
            fullPage: true,
        })
        results.push({
            engine: name,
            method:
                name === 'Chromium'
                    ? 'origin stopped and browser offline'
                    : 'origin stopped; upstream requests aborted',
            offlineReload: 'passed',
            bookmarkPersistence: 'passed',
            cachedRouteSearch: 'passed',
            standaloneManifest: 'passed',
            errors,
        })
        console.log(name, 'offline app reload, bookmarks, route search, manifest: PASS')
    } finally {
        server.closeAllConnections()
        server.close()
        await browser.close()
    }
}
await writeFile('artifacts/offline-smoke.json', JSON.stringify(results, null, 2))
