import { useLayoutEffect } from 'react'
import { DEFAULT_GLASS, type GlassPreferences } from '../utils/glass'

export function useGlass(preferences: GlassPreferences = DEFAULT_GLASS) {
    useLayoutEffect(() => {
        const root = document.documentElement
        const contrast = matchMedia('(prefers-contrast: more)')
        const transparency = matchMedia('(prefers-reduced-transparency: reduce)')
        const apply = () => {
            root.dataset.glass = preferences.mode
            root.dataset.glassEffective =
                preferences.mode === 'reduced' ||
                (preferences.mode === 'auto' && (contrast.matches || transparency.matches))
                    ? 'reduced'
                    : 'full'
            root.dataset.refraction = String(preferences.refraction)
            root.style.setProperty('--glass-intensity', String(preferences.intensity))
        }
        apply()
        contrast.addEventListener('change', apply)
        transparency.addEventListener('change', apply)
        return () => {
            contrast.removeEventListener('change', apply)
            transparency.removeEventListener('change', apply)
        }
    }, [preferences])
}
