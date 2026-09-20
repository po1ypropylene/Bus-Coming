import { chromium, webkit, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, extname } from 'node:path'

// Serve two releases of the production shell with different precache revisions.
// Does not change dist or touch a user's browser profile.
for (const [name, engine] of [
    ['Chromium', chromium],
    ['WebKit', webkit],
]) {
    let release = 1
    const server = createServer(async (req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname
        const file = resolve('dist', pathname === '/' ? 'index.html' : '.' + pathname)
        if (!file.startsWith(resolve('dist') + '/')) return res.writeHead(403).end()
        try {
            let data = await readFile(file)
            if (file.endsWith('/index.html'))
                data = Buffer.from(
                    data
                        .toString()
                        .replace('<head>', `<head><meta name="test-release" content="${release}">`),
                )
            if (file.endsWith('/sw.js'))
                data = Buffer.from(
                    data
                        .toString()
                        .replace(/(url:"index.html",revision:")[^"]+/, `$1test-release-${release}`),
                )
            res.writeHead(200, {
                'Cache-Control': 'no-cache',
                'Content-Type':
                    {
                        '.html': 'text/html',
                        '.js': 'text/javascript',
                        '.css': 'text/css',
                        '.svg': 'image/svg+xml',
                    }[extname(file)] ?? 'application/octet-stream',
            })
            res.end(data)
        } catch {
            res.writeHead(404).end()
        }
    })
    await new Promise((resolve) => server.listen(4182, '127.0.0.1', resolve))
    const browser = await engine.launch()
    try {
        const page = await browser.newPage()
        await page.route('https://**/*', (req) => req.abort())
        await page.goto('http://127.0.0.1:4182')
        await page.evaluate(() => navigator.serviceWorker.ready)
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
        await page.evaluate(() =>
            localStorage.setItem(
                'bus-coming-user-v1',
                JSON.stringify({ version: 1, language: 'en', theme: 'blue', bookmarks: [] }),
            ),
        )
        await page.reload()
        await page.getByRole('button', { name: 'Settings', exact: true }).click()
        release = 2
        await page.getByRole('button', { name: 'Check for app updates', exact: true }).click()
        await expect(
            page.getByRole('button', { name: 'Update and reload', exact: true }),
        ).toBeVisible({ timeout: 30000 })
        await expect(page.locator('meta[name="test-release"]')).toHaveAttribute('content', '1')
        await page.getByRole('button', { name: 'Update and reload', exact: true }).click()
        await expect(page.locator('meta[name="test-release"]')).toHaveAttribute('content', '2')
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'blue')
        await page.getByRole('button', { name: 'Settings', exact: true }).click()
        await page.getByRole('button', { name: 'Check for app updates', exact: true }).click()
        await expect(page.getByText('This app is up to date.', { exact: true })).toBeVisible()
        release = 3
        await page.clock.install({ time: new Date(Date.now() + 61000) })
        await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
        await expect(
            page.getByRole('button', { name: 'Update and reload', exact: true }),
        ).toBeVisible({ timeout: 30000 })
        await page.getByRole('button', { name: 'Update and reload', exact: true }).click()
        await expect(page.locator('meta[name="test-release"]')).toHaveAttribute('content', '3')
        console.log(
            `${name}: production upgrade, explicit reload, preference preservation, current-version and resume checks PASS`,
        )
    } finally {
        await browser.close()
        await new Promise((resolve) => server.close(resolve))
    }
}
