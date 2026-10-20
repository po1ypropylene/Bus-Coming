import { expect, test } from './test'
import { route, seed, stop } from './fixtures'

test('Citybus replaces a departed prediction and fills the third column when supplied', async ({
    page,
}) => {
    const now = Date.parse('2026-10-20T08:36:00+08:00')
    await page.clock.install({ time: new Date(now) })
    await page.clock.pauseAt(new Date(now + 1000))
    const fixtureStop = { ...stop, id: 'CTB:003155', code: '003155', provider: 'CTB' }
    const fixtureRoute = {
        ...route,
        id: 'CTB:720:O:1',
        number: '720',
        provider: 'CTB',
        stops: [{ id: fixtureStop.id, seq: 1 }],
    }
    await seed(page, 2, { route: fixtureRoute, stop: fixtureStop })
    // Constructed transitions: a withdrawn row, a sparse response, then replenishment.
    // eta_seq is a provider rank, not a required consecutive UI column index.
    let minutes: (number | null)[] = [0, 5, 14, 24]
    let requests = 0
    await page.route('**/eta/**', (request) => {
        requests++
        return request.fulfill({
            json: {
                data: minutes.map((minute, i) => ({
                    co: 'CTB',
                    route: '720',
                    dir: 'O',
                    stop: fixtureStop.code,
                    seq: 1,
                    eta_seq: i + 1,
                    eta: minute === null ? null : new Date(now + minute * 60000).toISOString(),
                })),
            },
        })
    })
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await page.locator('.route-row').click()
    await page.locator('.stop-main').click()
    await expect(page.locator('.arrival-clock')).toHaveText(['08:36', '08:41', '08:50'])

    const refresh = async () => {
        const previous = requests
        await page.getByRole('button', { name: 'Refresh', exact: true }).click()
        await expect.poll(() => requests).toBe(previous + 1)
        await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
    }
    minutes = [null, 5, 14, 24]
    await refresh()
    await expect(page.locator('.arrival-clock')).toHaveText(['08:41', '08:50', '09:00'])

    minutes = [null, 5, 14]
    await refresh()
    await expect(page.locator('.arrival-clock')).toHaveText(['08:41', '08:50'])

    // A newly available third prediction is picked up automatically after 15s.
    minutes = [null, 5, 14, 24]
    const sparseRequests = requests
    await page.clock.fastForward(14999)
    expect(requests).toBe(sparseRequests)
    await page.clock.fastForward(1)
    await expect(page.locator('.arrival-clock')).toHaveText(['08:41', '08:50', '09:00'])
    expect(requests).toBe(sparseRequests + 1)
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()

    // A full card returns to the normal 30s cadence.
    const fullRequests = requests
    await page.clock.fastForward(15000)
    expect(requests).toBe(fullRequests)
    await page.clock.fastForward(15000)
    await expect.poll(() => requests).toBe(fullRequests + 1)
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()

    // No-service responses do not trigger the faster sparse-card cadence.
    minutes = []
    await refresh()
    await expect(page.locator('.arrival-time')).toHaveCount(0)
    const emptyRequests = requests
    await page.clock.fastForward(15000)
    expect(requests).toBe(emptyRequests)
    await page.clock.fastForward(15000)
    await expect.poll(() => requests).toBe(emptyRequests + 1)
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()

    // Eligibility is still checked if a browser misses the focus event on resume.
    await page.evaluate(() => {
        Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false })
    })
    const backgroundRequests = requests
    await page.clock.fastForward(30000)
    expect(requests).toBe(backgroundRequests)
    await page.evaluate(() => {
        Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => true })
    })
    await page.clock.fastForward(30000)
    await expect.poll(() => requests).toBe(backgroundRequests + 1)
})
