import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
    testDir: './tests',
    timeout: 45000,
    fullyParallel: true,
    use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block', trace: 'retain-on-failure' },
    projects: [
        {
            name: 'iPhone-17-Pro-Max-WebKit',
            use: {
                ...devices['iPhone 16 Pro Max'],
                browserName: 'webkit',
                viewport: { width: 440, height: 956 },
                deviceScaleFactor: 3,
                isMobile: true,
                hasTouch: true,
            },
        },
        {
            name: 'desktop-chromium',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
        },
    ],
    webServer: {
        command: 'npm run dev -- --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
    },
})
