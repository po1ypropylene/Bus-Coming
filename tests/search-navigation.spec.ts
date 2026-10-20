import { expect, test } from './test'
import { seed } from './fixtures'

for (const safeArea of [false, true]) {
    test(`search retains working navigation with keypad open${safeArea ? ' and simulated safe areas' : ''}`, async ({
        page,
    }) => {
        if (safeArea) {
            // Synthetic geometry checks, not a claim of physical iPhone standalone validation.
            await page.route('**/src/styles/*.css', async (request) => {
                const response = await request.fetch()
                const body = (await response.text())
                    .replaceAll('env(safe-area-inset-top)', '62px')
                    .replaceAll('env(safe-area-inset-bottom)', '34px')
                await request.fulfill({ response, body })
            })
        }
        await seed(page)
        for (const viewport of [
            { width: 320, height: 568 },
            { width: 390, height: 844 },
            { width: 440, height: 956 },
        ]) {
            await page.setViewportSize(viewport)
            for (let visit = 0; visit < 2; visit++) {
                await page.getByRole('button', { name: 'Routes', exact: true }).click()
                await expect(
                    page.getByRole('button', { name: 'Hide keypad', exact: true }),
                ).toBeVisible()
                const nav = page.getByRole('navigation')
                await expect(nav).toBeVisible()
                const navBounds = await nav.boundingBox()
                const keypadBounds = await page.locator('.keypad').boundingBox()
                const resultBounds = await page.locator('.search-results').boundingBox()
                expect(keypadBounds!.y + keypadBounds!.height).toBeLessThanOrEqual(navBounds!.y)
                expect(navBounds!.y + navBounds!.height).toBeLessThanOrEqual(
                    viewport.height - (safeArea ? 34 : 0),
                )
                expect(resultBounds!.height).toBeGreaterThan(0)
                await page.getByRole('button', { name: '1', exact: true }).click()
                await expect(page.getByRole('textbox')).toHaveValue('1')
                // Leave Search directly, without using Hide keypad as a workaround.
                await page.getByRole('button', { name: 'Settings', exact: true }).click()
                await expect(
                    page.getByRole('heading', { name: 'Settings', exact: true }),
                ).toBeVisible()
                await page.getByRole('button', { name: 'Routes', exact: true }).click()
                await page.getByRole('button', { name: 'Hide keypad', exact: true }).click()
                await expect(nav).toBeVisible()
                await page.getByRole('button', { name: 'Show keypad', exact: true }).click()
                await expect(nav).toBeVisible()
                await page
                    .locator('.keypad')
                    .getByRole('button', { name: 'Clear', exact: true })
                    .click()
                await page.getByRole('button', { name: 'Saved', exact: true }).click()
            }
        }
    })
}
