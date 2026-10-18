import { arrivalAge, arrivalCountdown } from '../../utils/arrivals'
import { useMemo } from 'react'
import { useApp } from '../../app/AppContext'
import type { Copy } from '../../i18n'
import { company } from '../../i18n'
import { RefreshCw } from 'lucide-react'
import { useArrivals } from '../../hooks/useArrivals'
import type { Lang, Route, Stop } from '../../types/transit'

export function ArrivalPanel({
    route,
    stop,
    seq,
    lang,
    t,
    knownStops,
}: {
    route: Route
    stop: Stop
    seq: number
    lang: Lang
    t: Copy
    knownStops?: Record<string, Stop>
}) {
    const { stops } = useApp()
    const availableStops = useMemo(
        () => (knownStops ? { ...stops, ...knownStops } : stops),
        [stops, knownStops],
    )
    const { panelRef, result, failed, loading, fetching, online, now, stale, arrivals, refresh } =
        useArrivals(route, stop, seq, lang, availableStops)
    const departures = arrivals.filter((a) => a.time !== null)
    const showDestinations = new Set(departures.map((a) => a.destination).filter(Boolean)).size > 1
    return (
        <div ref={panelRef} className={`arrival-panel ${stale ? 'stale' : ''}`}>
            <div className="arrival-top">
                <span>
                    <i className={`live-dot ${stale ? 'muted' : !result ? 'waiting' : ''}`} />
                    {!online ? t.offlineLabel : stale ? t.stale : t.eta}
                </span>
                <button
                    className="icon-button"
                    aria-label={t.refresh}
                    onClick={refresh}
                    disabled={fetching || !online}
                    aria-busy={fetching}
                >
                    <RefreshCw size={16} className={fetching ? 'spin' : undefined} />
                </button>
            </div>
            <div className="arrival-times" aria-busy={loading} role="region" aria-label={t.eta}>
                {loading ? (
                    <div className="arrival-skeleton" role="status" aria-label={t.loadingEta}>
                        {[0, 1, 2].map((row) => (
                            <div key={row} />
                        ))}
                    </div>
                ) : arrivals.length ? (
                    arrivals.map((a, i) => (
                        <div className="arrival-time" key={`${a.time}-${i}`}>
                            <div className="arrival-countdown">
                                <strong
                                    className={
                                        a.time !== null && a.time - now <= 60000
                                            ? 'arrival-due'
                                            : undefined
                                    }
                                >
                                    {arrivalCountdown(a.time, now, t)}
                                </strong>
                                {a.time !== null && a.time - now > 60000 && <span>{t.min}</span>}
                                {a.time !== null && (
                                    <small className="arrival-clock">
                                        {new Date(a.time).toLocaleTimeString(
                                            lang === 'tc' ? 'zh-HK' : 'en-GB',
                                            {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false,
                                                timeZone: 'Asia/Hong_Kong',
                                            },
                                        )}
                                    </small>
                                )}
                            </div>
                            <div className="arrival-description">
                                {showDestinations && a.destination && (
                                    <small className="arrival-destination">
                                        {t.toward} {a.destination}
                                    </small>
                                )}
                                {a.provider && <small>{company(a.provider, lang === 'tc')}</small>}
                                {a.remark && <small className="arrival-remark">{a.remark}</small>}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="muted-text">
                        {!online ? t.offline : failed ? t.unavailable : t.noEta}
                    </p>
                )}
                {failed && arrivals.length > 0 && (
                    <p className="muted-text" role="status">
                        {t.unavailable}
                    </p>
                )}
                {result?.partial && (
                    <p className="muted-text" role="status">
                        {t.partialEta}
                    </p>
                )}
            </div>
            <div className="arrival-foot">
                {result && <span>{arrivalAge(result.fetchedAt, now, t)}</span>}
                {failed && online && (
                    <button className="text-button" onClick={refresh} disabled={fetching}>
                        {t.retryEta}
                    </button>
                )}
            </div>
            {route.provider === 'NLB' && <small className="muted-text">{t.nlbEstimate}</small>}
        </div>
    )
}
