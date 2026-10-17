import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
const { version } = JSON.parse(
    readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
    version: string
}

const https =
    process.env.BUS_HTTPS_KEY && process.env.BUS_HTTPS_CERT
        ? {
              key: readFileSync(process.env.BUS_HTTPS_KEY),
              cert: readFileSync(process.env.BUS_HTTPS_CERT),
          }
        : undefined
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [
        react(),
        VitePWA({
            registerType: 'prompt',
            injectRegister: false,
            includeAssets: ['apple-touch-icon.png'],
            manifest: {
                id: '/',
                name: 'Bus Coming · 巴士就到',
                short_name: 'Bus Coming',
                description: 'Your next Hong Kong bus, a little closer.',
                lang: 'en',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                background_color: '#f6f8fc',
                theme_color: '#f6f8fc',
                icons: [
                    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
                    {
                        src: '/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable',
                    },
                ],
            },
            workbox: {
                cacheId: `bus-coming-v${version}`,
                globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
                navigateFallback: '/index.html',
                cleanupOutdatedCaches: true,
                clientsClaim: true,
            },
        }),
    ],
    server: { host: '0.0.0.0', https },
    preview: { host: '0.0.0.0', https },
})
