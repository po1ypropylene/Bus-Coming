import prettierRecommended from 'eslint-plugin-prettier/recommended'
import babelParser from '@babel/eslint-parser'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
    globalIgnores([
        'dist',
        'artifacts',
        'test-results',
        'playwright-report',
        '.catalog-tools',
        '.citybus-public',
        '.citybus-staging',
        '.citybus-checkpoints',
    ]),
    {
        files: ['**/*.{ts,tsx}'],
        extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
        languageOptions: {
            parser: babelParser,
            parserOptions: {
                requireConfigFile: false,
                babelOptions: {
                    babelrc: false,
                    configFile: false,
                    parserOpts: { plugins: ['typescript', 'jsx'] },
                },
            },
            globals: globals.browser,
        },
        // Retain core checks whose Oxlint equivalents do not accept the same configuration.
        rules: {
            'no-octal': 'error',
            'preserve-caught-error': 'error',
        },
    },
    prettierRecommended,
])
