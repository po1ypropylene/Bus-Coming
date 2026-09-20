import { useLayoutEffect } from 'react'
import type { Theme } from '../types/transit'

export function useTheme(theme: Theme) {
    useLayoutEffect(() => {
        const root = document.documentElement
        root.dataset.theme = theme
        const appearance = window.matchMedia('(prefers-color-scheme: dark)')
        const updateChrome = () => {
            document
                .querySelector('meta[name="theme-color"]')
                ?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim())
        }
        updateChrome()
        appearance.addEventListener('change', updateChrome)
        return () => appearance.removeEventListener('change', updateChrome)
    }, [theme])
}
