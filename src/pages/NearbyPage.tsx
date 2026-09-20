import { ChevronRight, LocateFixed, MapPin } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { DownloadCard } from '../components/catalog/DownloadCard'
import { RouteRow } from '../components/routes/RouteRow'
import { company } from '../i18n'
export function NearbyPage() {
  const {
    t,
    tc,
    position,
    locating,
    locate,
    locationError,
    nearby,
    snapshots,
    nearStop,
    setNearStop,
    byRoute,
    openRoute,
    routes,
    lang,
  } = useApp()
  return (
    <>
      <div className="location-card">
        <div className="location-illustration">
          <LocateFixed size={34} />
        </div>
        <div>
          <h2>{position ? `${nearby.length} ${t.stops}` : t.discover}</h2>
          <p>{position ? `${t.accuracy}: ±${Math.round(position.accuracy)} m` : t.locateBody}</p>
        </div>
        <button className="primary" disabled={locating} onClick={locate}>
          <LocateFixed size={18} />
          {locating ? t.locating : t.locate}
        </button>
      </div>
      {locationError && (
        <p className="banner error" role="alert">
          {t.locationError}
        </p>
      )}
      {position && (
        <>
          <div className="section-heading">
            <h2>{t.radius}</h2>
            <span>
              {nearby.length} {t.stops}
            </span>
          </div>
          {nearby.length ? (
            <div className="list-card">
              {nearby.map(({ stop, meters }) => {
                const links =
                  snapshots.find((s) => s.provider === stop.provider)?.stopRoutes[stop.id] ?? []
                return (
                  <article key={stop.id}>
                    <button
                      className="near-stop"
                      aria-expanded={nearStop === stop.id}
                      onClick={() => setNearStop(nearStop === stop.id ? null : stop.id)}
                    >
                      <span className="near-pin">
                        <MapPin size={20} />
                      </span>
                      <span>
                        <strong>{stop.name[lang]}</strong>
                        <small>
                          {company(stop.provider, tc)} ·{' '}
                          {[...new Set(links.map((l) => byRoute.get(l.routeId)?.number))].join(
                            ', ',
                          )}
                        </small>
                      </span>
                      <span className="distance">
                        {Math.round(meters)} m<ChevronRight size={16} />
                      </span>
                    </button>
                    {nearStop === stop.id && (
                      <div className="near-routes">
                        <p className="eyebrow">{t.routesHere}</p>
                        {links.map((link) => {
                          const route = byRoute.get(link.routeId)
                          return route ? (
                            <div key={`${link.routeId}:${link.seq}`}>
                              <RouteRow
                                route={route}
                                onClick={() => openRoute(route, { id: stop.id, seq: link.seq })}
                              />
                            </div>
                          ) : null
                        })}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-inline">
              <MapPin size={34} />
              <h2>{t.noNearby}</h2>
              <p>{t.noNearbyBody}</p>
            </div>
          )}
        </>
      )}
      {snapshots.length < 3 && <p className="footnote">{t.downloadingHint}</p>}
      {!routes.length && <DownloadCard />}
    </>
  )
}
