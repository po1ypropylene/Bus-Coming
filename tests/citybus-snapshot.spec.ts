import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'

test('first launch downloads shared Citybus data and preserves it across offline reload', async ({
                                                                                                     page,
                                                                                                     context,
                                                                                                 }) => {
    const updatedAt = Date.now()
    const stop = {
        id: 'CTB:001234',
        code: '001234',
        provider: 'CTB',
        name: { en: 'Shared stop', tc: '共享車站' },
        lat: 22.3,
        lng: 114.2,
    }
    const route = {
        id: 'CTB:2X:I:1',
        number: '2X',
        provider: 'CTB',
        bound: 'I',
        service: '1',
        origin: { en: 'Start', tc: '起點' },
        destination: { en: 'End', tc: '終點' },
        stops: [{ id: stop.id, seq: 1 }],
    }
    const body = JSON.stringify({
        schemaVersion: 1,
        provider: 'CTB',
        updatedAt,
        routes: [route],
        stops: { [stop.id]: stop },
    })
    const sha256 = createHash('sha256').update(body).digest('hex')
    let payloadRequests = 0
    let officialRequests = 0
    await context.route('**/catalog/citybus/**', async (req) => {
        if (req.request().url().endsWith('/manifest.json')) {
            await req.fulfill({
                json: {
                    schemaVersion: 1,
                    updatedAt,
                    sha256,
                    bytes: Buffer.byteLength(body),
                    file: `snapshot-${sha256}.json`,
                },
            })
        } else {
            payloadRequests++
            await req.fulfill({ body, contentType: 'application/json' })
        }
    })
    await context.route('https://rt.data.gov.hk/v2/transport/citybus/**', async (req) => {
        officialRequests++
        await req.abort()
    })
    await context.route('https://data.etabus.gov.hk/**', (req) => req.abort())
    await context.route('https://rt.data.gov.hk/v2/transport/nlb/**', (req) => req.abort())
    await page.goto('/')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByText('Ready offline', { exact: true })).toHaveCount(1)
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await expect(page.locator('.route-row')).toHaveCount(1)
    await page.locator('.route-row').click()
    await expect(page.locator('.stop-list')).toContainText('Shared stop')
    expect(payloadRequests).toBe(1)
    expect(officialRequests).toBe(0)
    // Block all external data while leaving the dev shell reachable; production offline is checked separately.
    await context.route('**/catalog/citybus/**', (req) => req.abort())
    await page.reload()
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await expect(page.locator('.route-row')).toHaveCount(1)
    await page.locator('.route-row').click()
    await expect(page.locator('.stop-list')).toContainText('Shared stop')
    expect(officialRequests).toBe(0)
})
