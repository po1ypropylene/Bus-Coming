// Apply only validated preferences before the app styles or React paint.
;(() => {
    let glass = { mode: 'auto', intensity: 0.45, refraction: true }
    try {
        const stored = JSON.parse(localStorage.getItem('bus-coming-user-v1'))?.glass
        if (
            stored &&
            ['auto', 'full', 'reduced'].includes(stored.mode) &&
            Number.isFinite(stored.intensity) &&
            stored.intensity >= 0 &&
            stored.intensity <= 1 &&
            typeof stored.refraction === 'boolean'
        )
            glass = stored
    } catch {
        /* Storage may be unavailable. Defaults remain usable. */
    }
    const root = document.documentElement
    root.dataset.glass = glass.mode
    root.dataset.glassEffective =
        glass.mode === 'reduced' ||
        (glass.mode === 'auto' &&
            (matchMedia('(prefers-contrast: more)').matches ||
                matchMedia('(prefers-reduced-transparency: reduce)').matches))
            ? 'reduced'
            : 'full'
    root.dataset.refraction = String(glass.refraction)
    root.style.setProperty('--glass-intensity', String(glass.intensity))
})()
