import type { Page } from '@playwright/test'

/** Mobile navigation is deliberately hidden while the custom keypad is open. */
export async function navigateTab(page: Page, name: string) {
    const current = page
        .locator('.tab-bar')
        .getByRole('button', { name, exact: true, includeHidden: true })
    const alreadyCurrent =
        (await current.getAttribute('aria-current')) === 'page' &&
        (await page.locator('.route-heading').count()) === 0
    if (!alreadyCurrent && !(await page.locator('.tab-bar').isVisible())) {
        const hide = page.getByRole('button', { name: /^(Hide keypad|隱藏鍵盤)$/ })
        if (await hide.isVisible()) await hide.click()
    }
    if (!alreadyCurrent) await page.getByRole('button', { name, exact: true }).last().click()
    if (name === 'Routes') {
        const show = page.getByRole('button', { name: /^(Show keypad|顯示鍵盤)$/ })
        if (await show.isVisible()) await show.click()
    }
}
