import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        ssr: 'scripts/generate-citybus.ts',
        outDir: '.catalog-tools',
        target: 'node22',
        minify: false,
        rollupOptions: { output: { entryFileNames: 'generate-citybus.mjs' } },
    },
})
