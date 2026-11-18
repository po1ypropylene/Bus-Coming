import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './test'
import { openStop, seed } from './fixtures'
import { navigateTab } from './navigation'

test('save sheet names, focus, dismissal and native submission work in both languages', async ({
    page,
}) => {
    await seed(page)
    await openStop(page)
    for (const chinese of [false, true]) {
        if (chinese) await page.getByRole('button', { name: 'Language', exact: true }).click()
        const invoker = page.locator('.stop-expanded > button')
        await invoker.focus()
        await invoker.press('Enter')
        const dialog = page.getByRole('dialog')
        await expect(dialog).toHaveAccessibleName(chinese ? '收藏車站' : 'Save stop')
        const input = dialog.getByRole('textbox')
        await expect(input).toBeFocused()
        await expect(input).toHaveAccessibleDescription(/.+/)
        expect(
            (await new AxeBuilder({ page }).include('.save-dialog').analyze()).violations,
        ).toEqual([])

        const bounds = (await dialog.boundingBox())!
        // Sheet padding must not act as a backdrop, including in Safari's fallback.
        await page.mouse.click(bounds.x + 4, bounds.y + 4)
        await expect(dialog).toBeVisible()
        await input.fill(chinese ? '公司' : 'Work')
        const field = (await input.boundingBox())!
        await page.mouse.move(field.x + 10, field.y + 10)
        await page.mouse.down()
        await page.mouse.move(2, 2)
        await page.mouse.up()
        await expect(dialog).toBeVisible()
        await input.focus()
        await page.keyboard.press('Escape')
        await expect(dialog).toHaveCount(0)
        await expect(invoker).toBeFocused()

        await invoker.press('Enter')
        await expect(input).toBeFocused()
        await page.mouse.click(2, 2)
        await expect(dialog).toHaveCount(0)
        await expect(invoker).toBeFocused()

        await invoker.press('Enter')
        await expect(input).toBeFocused()
        await input.fill(chinese ? '公司' : 'Work')
        await input.press('Enter')
        await expect(dialog).toHaveCount(0)
        await expect(page.locator('.toast')).toBeVisible()
        await expect(invoker).toBeFocused()
    }
})

test('navigation titles and filter states follow the visible screen and language', async ({
    page,
}) => {
    await seed(page)
    await expect(page).toHaveTitle('Saved | Bus Coming')
    await navigateTab(page, 'Routes')
    await expect(page).toHaveTitle('Routes | Bus Coming')
    await expect(page.getByRole('search')).toHaveCount(1)
    const operators = page.getByRole('group', { name: 'All operators' })
    await expect(operators.getByRole('button', { name: 'All', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
    )
    const keypad = page.getByRole('button', { name: 'Hide keypad' })
    await expect(keypad).toHaveAttribute('aria-expanded', 'true')
    await keypad.click()
    await expect(page.getByRole('button', { name: 'Show keypad' })).toHaveAttribute(
        'aria-expanded',
        'false',
    )
    await page.locator('.route-row').first().click()
    await expect(page).toHaveTitle('1A · To Star Ferry | Bus Coming')
    await page.getByRole('button', { name: 'Language', exact: true }).click()
    await expect(page).toHaveTitle('1A · 往 尖沙咀碼頭 | 巴士就到')
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant')
    await navigateTab(page, '設定')
    await expect(page).toHaveTitle('設定 | 巴士就到')
})
