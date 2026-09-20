import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
await mkdir('artifacts', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:5173')
await page.getByRole('button', { name: 'Settings', exact: true }).click()
let snapshots = []
for (let attempt = 0; attempt < 90; attempt++) {
    await page.waitForTimeout(10000)
    snapshots = await page.evaluate(
        () =>
            new Promise((resolve, reject) => {
                const req = indexedDB.open('bus-coming-v1', 2)
                req.onerror = () => reject(req.error)
                req.onsuccess = () => {
                    const all = req.result
                        .transaction('snapshots')
                        .objectStore('snapshots')
                        .getAll()
                    all.onsuccess = () => {
                        resolve(
                            all.result.map((s) => ({
                                provider: s.provider,
                                routes: s.routes.length,
                                stops: Object.keys(s.stops).length,
                                updatedAt: s.updatedAt,
                            })),
                        )
                        req.result.close()
                    }
                }
            }),
    )
    console.log(
        JSON.stringify({
            seconds: (attempt + 1) * 10,
            snapshots,
            status: await page.locator('.provider-setting').allTextContents(),
        }),
    )
    if (snapshots.length === 3) break
}
await page.getByRole('button', { name: 'Settings', exact: true }).click()
await page.screenshot({ path: 'artifacts/live-settings.png', fullPage: true })
await page.getByRole('button', { name: 'Routes', exact: true }).click()
await page.getByRole('textbox', { name: 'Route number' }).fill('1A')
await page.screenshot({ path: 'artifacts/live-search.png', fullPage: true })
if (await page.locator('.route-row').count()) {
    await page.locator('.route-row').first().click()
    await page.locator('.stop-main').first().click()
    await page.waitForTimeout(8000)
    await page.screenshot({ path: 'artifacts/live-route.png', fullPage: true })
}
await writeFile('artifacts/live-smoke.json', JSON.stringify({ snapshots, errors }, null, 2))
await browser.close()
if (snapshots.length !== 3 || errors.length) process.exitCode = 1
