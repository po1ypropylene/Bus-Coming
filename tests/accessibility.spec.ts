import { navigateTab } from './navigation'
import { chromium, expect, test } from './test'
import puppeteer from 'puppeteer-core'
import { snapshot } from 'lighthouse'
import { openStop, seed } from './fixtures'

test('Lighthouse accessibility scores at least 95 for every tab and route details', async ({
    browserName,
    baseURL,
}) => {
    test.skip(browserName !== 'chromium', 'Lighthouse requires Chromium; axe also covers WebKit.')
    test.setTimeout(180000)
    const auditBrowser = await puppeteer.launch({
        executablePath: chromium.executablePath(),
        headless: true,
    })
    const browser = await chromium.connectOverCDP(auditBrowser.wsEndpoint())
    try {
        const context = await browser.newContext({
            baseURL,
            viewport: { width: 390, height: 844 },
            serviceWorkers: 'block',
        })
        const page = await context.newPage()
        await seed(page)
        await openStop(page)
        await page.getByRole('button', { name: 'Save stop', exact: true }).click()
        await page.getByRole('button', { name: 'Done', exact: true }).click()
        const auditPage = (await auditBrowser.pages()).find(
            (candidate) => candidate.url() === page.url(),
        )!
        const testInfo = test.info()
        const scores: Record<string, number | null> = {}
        for (const locale of ['en', 'tc']) {
            if (locale === 'tc')
                await page.getByRole('button', { name: 'Language', exact: true }).click()
            const tabs =
                locale === 'en'
                    ? ['Saved', 'Nearby', 'Routes', 'Settings']
                    : ['收藏', '附近', '路線', '設定']
            for (const tab of [...tabs, 'details']) {
                if (tab === 'details') {
                    await page.getByRole('button', { name: tabs[2], exact: true }).click()
                    await page.locator('.route-row').first().click()
                    await page.locator('.stop-main').click()
                    await expect(page.locator('.arrival-time')).toHaveCount(1)
                } else {
                    await navigateTab(page, tab)
                }
                const result = await snapshot(auditPage, {
                    flags: {
                        onlyCategories: ['accessibility'],
                        screenEmulation: { disabled: true },
                    },
                })
                const score = result!.lhr.categories.accessibility.score
                scores[`${locale}/${tab}`] = score
                await testInfo.attach(`lighthouse-${locale}-${tab}`, {
                    body: JSON.stringify(result!.lhr),
                    contentType: 'application/json',
                })
                expect(
                    score,
                    `${locale}/${tab}: ${JSON.stringify(
                        Object.values(result!.lhr.audits)
                            .filter((audit) => audit.score === 0)
                            .map((audit) => audit.id),
                    )}`,
                ).toBeGreaterThanOrEqual(0.95)
                expect(result!.lhr.audits['color-contrast'].score).toBe(1)
            }
        }
        console.log('Lighthouse accessibility:', JSON.stringify(scores))
    } finally {
        await browser.close()
        await auditBrowser.close()
    }
})
