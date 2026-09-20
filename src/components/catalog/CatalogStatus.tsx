import { RefreshCw } from 'lucide-react'
import { useApp } from '../../app/AppContext'
import { company } from '../../i18n'
import { PROVIDERS } from '../../types/transit'

export function CatalogStatus() {
    const { snapshots, progress, operator, t, tc, busy, refresh, routes } = useApp()
    const pending = PROVIDERS.filter(
        (p) =>
            (operator === 'all' || operator === p) &&
            (!snapshots.some((s) => s.provider === p) ||
                progress.some((state) => state.provider === p && state.state === 'error')),
    )
    if (!pending.length) return null
    return (
        <div className="catalog-status" role="status">
            {pending.map((provider) => {
                const p = progress.find((p) => p.provider === provider)
                return (
                    <div key={provider}>
                        <strong>{company(provider, tc)}</strong>
                        <p>
                            {p?.state === 'error'
                                ? t.failed
                                : provider === 'CTB' && routes.some((r) => r.provider === 'CTB')
                                  ? t.citybusPending
                                  : t.operatorPending}
                        </p>
                        {p?.state === 'downloading' && (
                            <span>
                                {p.done} / {p.total}
                            </span>
                        )}
                    </div>
                )
            })}
            {!busy && (
                <button className="text-button" onClick={() => refresh(false)}>
                    <RefreshCw size={16} />
                    {t.retry}
                </button>
            )}
        </div>
    )
}
