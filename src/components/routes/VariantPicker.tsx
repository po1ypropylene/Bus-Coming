import { useId } from 'react'
import { useApp } from '../../app/AppContext'
import type { useRouteVariants } from '../../hooks/useRouteVariants'

export function VariantPicker({ state }: { state: ReturnType<typeof useRouteVariants> }) {
    const { t, lang, variantError } = useApp()
    const id = useId()
    if (state.options.length < 2) return null
    return (
        <section className="variant-picker" aria-label={t.routeVariant}>
            <label htmlFor={id}>{t.routeVariant}</label>
            <select
                id={id}
                value={state.manual ?? 'auto'}
                onChange={(e) => state.setManual(e.target.value === 'auto' ? null : e.target.value)}
            >
                <option value="auto">{t.variantAutomatic}</option>
                <option value="operator">{t.variantOperatorList}</option>
                {state.options.map(({ variant, entries }) => (
                    <option key={variant.id} value={variant.id}>
                        {entries[0].stop.name[lang]} → {entries.at(-1)!.stop.name[lang]} ·{' '}
                        {variant.name[lang]}
                    </option>
                ))}
            </select>
            {state.selected && (
                <p className="variant-name" role="status">
                    {state.selected.variant.name[lang]}
                </p>
            )}
            {state.next !== null && (
                <p>
                    {t.variantNext}:{' '}
                    {new Date(state.next).toLocaleString(lang === 'tc' ? 'zh-HK' : 'en-GB', {
                        timeZone: 'Asia/Hong_Kong',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                    })}
                </p>
            )}
            <p className="footnote">{t.variantScheduleHint}</p>
            {variantError && (
                <p className="error-text" role="status">
                    {t.variantLoadError}
                </p>
            )}
        </section>
    )
}
