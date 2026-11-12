import { navigateTab } from './navigation'
import { expect, test } from './test'
import { openStop, route, seed, stop } from './fixtures'

const bookmark = {
    id: 'existing',
    routeId: route.id,
    stopId: stop.id,
    seq: 1,
    group: 'Work',
    route,
    stop,
}
const backup = (bookmarks: unknown[] = [bookmark]) => ({ version: 1, language: 'en', bookmarks })

test.beforeEach(async ({ context }) => {
    await context.route('https://data.etabus.gov.hk/**', (request) => request.abort())
    await context.route('https://rt.data.gov.hk/**', (request) => request.abort())
})

test('retry resumes a failed forced refresh even when the retained snapshot is fresh', async ({
    page,
    context,
}) => {
    await seed(page)
    let recover = false
    let catalogueRequests = 0
    await context.route('https://data.etabus.gov.hk/**', (request) => {
        const path = new URL(request.request().url()).pathname
        if (path.endsWith('/route/')) catalogueRequests++
        if (!recover) return request.fulfill({ status: 403, body: 'Unavailable' })
        const data = path.endsWith('/route/')
            ? [
                  {
                      route: '1A',
                      bound: 'O',
                      service_type: '1',
                      orig_en: 'Origin',
                      orig_tc: '起點',
                      dest_en: 'End',
                      dest_tc: '終點',
                  },
              ]
            : path.endsWith('/route-stop')
              ? [{ route: '1A', bound: 'O', service_type: '1', stop: stop.code, seq: 1 }]
              : [
                    {
                        stop: stop.code,
                        name_en: stop.name.en,
                        name_tc: stop.name.tc,
                        lat: stop.lat,
                        long: stop.lng,
                    },
                ]
        return request.fulfill({ json: { data } })
    })
    await context.route('https://rt.data.gov.hk/**', (request) =>
        request.fulfill({ status: 403, body: 'Unavailable' }),
    )
    await navigateTab(page, 'Settings')
    const refresh = page.getByRole('button', { name: 'Refresh route data', exact: true })
    await refresh.click()
    await expect(
        page
            .locator('.provider-setting')
            .filter({ has: page.locator('.status-pill') })
            .locator('.error-text'),
    ).toHaveCount(3)
    await expect(refresh).toBeEnabled()
    expect(catalogueRequests).toBe(1)
    recover = true
    await navigateTab(page, 'Routes')
    await page.locator('.catalog-status button').click()
    await expect.poll(() => catalogueRequests).toBe(2)
    await expect(page.locator('.route-row')).toHaveCount(1)
})

test('malformed nested backups preserve existing bookmarks and imported membership is discarded', async ({
    page,
}) => {
    await seed(page)
    await page.evaluate(
        (data) => localStorage.setItem('bus-coming-user-v1', JSON.stringify(data)),
        backup(),
    )
    await page.reload()
    await navigateTab(page, 'Settings')
    const before = await page.evaluate(() => localStorage.getItem('bus-coming-user-v1'))
    await page.locator('input[type=file]').setInputFiles({
        name: 'malformed.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
            JSON.stringify(backup([{ ...bookmark, route: { ...route, stops: [null] } }])),
        ),
    })
    await expect(page.locator('.toast')).toContainText('could not be imported')
    expect(await page.evaluate(() => localStorage.getItem('bus-coming-user-v1'))).toBe(before)
    await page.locator('input[type=file]').setInputFiles({
        name: 'legacy.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
            JSON.stringify(backup([{ ...bookmark, route: { ...route, jointPartners: [route] } }])),
        ),
    })
    await expect(page.locator('.toast')).toContainText('Backup imported')
    const restored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('bus-coming-user-v1')!),
    )
    expect(restored.bookmarks[0].route).not.toHaveProperty('jointPartners')
    expect(restored.theme).toBe('blue')
    await navigateTab(page, 'Saved')
    await expect(page.locator('.bookmark-card')).toHaveCount(1)
    await page.locator('.bookmark-route').click()
    await expect(page.locator('.stop-main')).toHaveCount(1)
})

test('renaming the last bookmark in the selected group restores the All filter', async ({
    page,
}) => {
    await seed(page)
    await openStop(page)
    await page.getByRole('button', { name: 'Save stop', exact: true }).click()
    await page.getByLabel('Group (optional)').fill('Work')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await navigateTab(page, 'Saved')
    await page.getByRole('button', { name: 'Work', exact: true }).click()
    await page.getByRole('button', { name: 'Change group', exact: true }).click()
    await page.getByLabel('Group (optional)').fill('Home')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.locator('.bookmark-card')).toHaveCount(1)
    await expect(page.locator('.chips .chip.active')).toContainText('All')
    await expect(page.getByRole('button', { name: 'Work', exact: true })).toHaveCount(0)
    await expect(page.locator('.bookmark-label')).toContainText('Home')
    await page.reload()
    await expect(page.locator('.bookmark-card')).toHaveCount(1)
    await expect(page.locator('.bookmark-label')).toContainText('Home')
})

test('an import merges against bookmarks at completion without resurrecting a removed stop', async ({
    page,
}) => {
    await seed(page)
    await page.evaluate(
        (data) => localStorage.setItem('bus-coming-user-v1', JSON.stringify(data)),
        backup(),
    )
    await page.reload()
    await navigateTab(page, 'Settings')
    await page.evaluate(() => {
        const read = File.prototype.text
        File.prototype.text = function () {
            return new Promise<string>((resolve, reject) => {
                Object.assign(window, {
                    releaseBackup: () => read.call(this).then(resolve, reject),
                })
            })
        }
    })
    await page.locator('input[type=file]').setInputFiles({
        name: 'delayed.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
            JSON.stringify(backup([{ ...bookmark, id: 'imported', group: 'Home' }])),
        ),
    })
    await navigateTab(page, 'Saved')
    await page.getByRole('button', { name: 'Remove saved stop', exact: true }).click()
    await expect(page.locator('.bookmark-card')).toHaveCount(0)
    await page.evaluate(() =>
        (window as unknown as { releaseBackup: () => Promise<void> }).releaseBackup(),
    )
    await expect(page.locator('.toast')).toContainText('Backup imported')
    await expect(page.locator('.bookmark-card')).toHaveCount(1)
    expect(
        await page.evaluate(() =>
            JSON.parse(localStorage.getItem('bus-coming-user-v1')!).bookmarks.map(
                (b: { id: string }) => b.id,
            ),
        ),
    ).toEqual(['imported'])
    await page.reload()
    await expect(page.locator('.bookmark-card')).toHaveCount(1)
    await expect(page.locator('.bookmark-label')).toContainText('Home')
})
