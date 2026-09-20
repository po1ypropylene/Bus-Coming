import { RefreshCw } from 'lucide-react'
import { useArrivals } from '../../hooks/useArrivals'
import type { Copy } from '../../i18n'
import type { Route, Stop, Lang } from '../../types/transit'
export function ArrivalPanel({
  route,
  stop,
  seq,
  lang,
  t,
}: {
  route: Route
  stop: Stop
  seq: number
  lang: Lang
  t: Copy
}) {
  const { result, failed, loading, now, stale, arrivals, refresh } = useArrivals(
    route,
    stop,
    seq,
    lang,
  )
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
      <div className="arrival-times" aria-live="polite">
        {loading ? (
          <p className="muted-text">{t.loadingEta}</p>
        ) : arrivals.length ? (
          arrivals.map((a, i) => (
            <div className="arrival-time" key={`${a.time}-${i}`}>
              <strong>
                {a.time === null
                  ? '—'
                  : Math.ceil((a.time - now) / 60000) <= 0
                    ? t.due
                    : Math.ceil((a.time - now) / 60000)}
              </strong>
              {a.time !== null && a.time > now && <span>{t.min}</span>}
              {a.remark && <small>{a.remark}</small>}
            </div>
          ))
        ) : (
          <p className="muted-text">{failed ? t.unavailable : t.noEta}</p>
        )}
      </div>
      <div className="arrival-foot">
        {failed && arrivals.length > 0 && <span>{t.unavailable} · </span>}
        {result &&
          `${t.updated} ${new Date(result.fetchedAt).toLocaleTimeString(lang === 'tc' ? 'zh-HK' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Hong_Kong' })}`}
      </div>
      {route.provider === 'NLB' && <small className="muted-text">{t.nlbEstimate}</small>}
    </div>
  )
}
