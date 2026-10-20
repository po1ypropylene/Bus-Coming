import type { Page } from '@playwright/test'

/** Navigate through the real tab buttons without hiding the search keypad. */
export async function navigateTab(page: Page, name: string) {
    const current = page.locator('.tab-bar').getByRole('button', { name, exact: true })
    const alreadyCurrent =
        (await current.getAttribute('aria-current')) === 'page' &&
        (await page.locator('.route-heading').count()) === 0
    if (!alreadyCurrent) await page.getByRole('button', { name, exact: true }).last().click()
    if (name === 'Routes') {
        const show = page.getByRole('button', { name: /^(Show keypad|顯示鍵盤)$/ })
        if (await show.isVisible()) await show.click()
    }
}
