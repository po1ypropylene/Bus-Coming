import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
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
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
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
                background_color: '#f7f9f7',
                theme_color: '#f7f9f7',
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
                globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
                navigateFallback: '/index.html',
                cleanupOutdatedCaches: true,
            },
        }),
    ],
    server: { host: '0.0.0.0', https },
    preview: { host: '0.0.0.0', https },
})
