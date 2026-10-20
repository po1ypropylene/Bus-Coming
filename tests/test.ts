import { test as base } from '@playwright/test'

// Browser regressions use fixtures, never a background live timetable download.
export const test = base.extend({
    context: async ({ context }, runContext) => {
        await context.route('https://static.data.gov.hk/td/pt-headway-*/**', (request) =>
            request.abort(),
        )
        await runContext(context)
    },
})
export { expect, chromium } from '@playwright/test'
