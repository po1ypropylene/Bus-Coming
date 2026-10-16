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
    const { result, failed, loading, now, stale, arrivals, refresh } = useArrivals(
        route,
        stop,
        seq,
        lang,
        availableStops,
    )
    const departures = arrivals.filter((a) => a.time !== null)
    const showDestinations = new Set(departures.map((a) => a.destination).filter(Boolean)).size > 1
    const showRows = showDestinations || new Set(departures.map((a) => a.remark.trim())).size > 1
    return (
        <div className={`arrival-panel ${stale ? 'stale' : ''}`}>
            <div className="arrival-top">
                <span>
                    <i className={`live-dot ${stale ? 'muted' : ''}`} />
                    {stale ? t.stale : t.eta}
                </span>
                <button className="icon-button" aria-label={t.refresh} onClick={refresh}>
                    <RefreshCw size={16} />
                </button>
            </div>
            <div className={`arrival-times ${showRows ? 'arrival-rows' : ''}`} aria-live="polite">
                {loading ? (
                    <p className="muted-text">{t.loadingEta}</p>
                ) : arrivals.length ? (
                    arrivals.map((a, i) => (
                        <div className="arrival-time" key={`${a.time}-${i}`}>
                            <div className="arrival-countdown">
                                <strong
                                    className={
                                        a.time !== null && a.time - now < 60000
                                            ? 'arrival-due'
                                            : undefined
                                    }
                                >
                                    {a.time === null
                                        ? '—'
                                        : a.time - now < 60000
                                            ? t.due
                                            : Math.ceil((a.time - now) / 60000)}
                                </strong>
                                {a.time !== null && a.time - now >= 60000 && <span>{t.min}</span>}
                            </div>
                            <div className="arrival-description">
                                {showDestinations && a.destination && (
                                    <small className="arrival-destination">
                                        {t.toward} {a.destination}
                                    </small>
                                )}
                                {a.provider && <small>{company(a.provider, lang === 'tc')}</small>}
                                {a.remark && <small>{a.remark}</small>}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="muted-text">{failed ? t.unavailable : t.noEta}</p>
                )}
            </div>
            {result?.partial && (
                <p className="muted-text" role="status">
                    {t.partialEta}
                </p>
            )}
            <div className="arrival-foot">
                {failed && arrivals.length > 0 && <span>{t.unavailable} · </span>}
                {result &&
                    `${t.updated} ${new Date(result.fetchedAt).toLocaleTimeString(
                        lang === 'tc' ? 'zh-HK' : 'en-GB',
                        {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Hong_Kong',
                        },
                    )}`}
            </div>
            {route.provider === 'NLB' && <small className="muted-text">{t.nlbEstimate}</small>}
        </div>
    )
}
