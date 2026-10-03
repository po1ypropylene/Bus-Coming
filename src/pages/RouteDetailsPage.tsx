import { oppositeRoute } from '../utils/routeDirection'
import { ArrowLeft, ArrowRightLeft, Bookmark as BookmarkIcon, ChevronRight } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { ArrivalPanel } from '../components/arrivals/ArrivalPanel'
import { RouteBadge } from '../components/routes/RouteBadge'
import { useJointItinerary } from '../hooks/useJointItinerary'
import { useRouteDetails } from '../hooks/useRouteDetails'
import { routeCompany } from '../i18n'
import type { Route } from '../types/transit'

export function RouteDetailsPage() {
    const { currentRoute: selectedRoute } = useApp()
    if (!selectedRoute) return null
    return <RouteDetails key={selectedRoute.id} route={selectedRoute}/>
}

function RouteDetails({ route }: { route: Route }) {
    const {
        setSelectedRoute,
        byRoute,
        openRoute,
        t,
        tc,
        lang,
        tab,
        user,
        selectedStop,
        setSelectedStop,
        bookmark,
        stops: downloadedStops,
    } = useApp()
    const {
        route: currentRoute,
        stops,
        loading,
        error,
        retry,
    } = useRouteDetails(route, downloadedStops)
    const reverse = oppositeRoute(route, byRoute.values())
    const itinerary = useJointItinerary(currentRoute, stops, downloadedStops)
    return (
        <>
            <button className="back-button" onClick={() => setSelectedRoute(null)}>
                <ArrowLeft size={18} />
                {t[tab]}
            </button>
            <section className="route-heading">
                <RouteBadge route={currentRoute} />
                <div className="route-heading-copy">
                    <p className="eyebrow">{routeCompany(currentRoute, tc)}</p>
                    <h1>{currentRoute.destination[lang]}</h1>
                    <p>
                        {t.from} {currentRoute.origin[lang]}
                    </p>
                </div>
                {reverse && (
                    <button
                        className="text-button direction-switch"
                        onClick={() => openRoute(reverse)}
                        aria-label={`${t.flipDirection}: ${reverse.destination[lang]}`}
                        title={`${t.flipDirection}: ${reverse.destination[lang]}`}
                    >
                        <ArrowRightLeft size={18}/>
                        <span>
                            {t.flipDirection}
                            <small>
                                {t.toward} {reverse.destination[lang]}
                            </small>
                        </span>
                    </button>
                )}
            </section>
            <div className="section-heading">
                <h2>{t.routeStops}</h2>
                <span>
                    {itinerary.entries.length} {t.stops}
                </span>
            </div>
            {loading && (
                <p className="banner" role="status">
                    {t.routeLoading}
                </p>
            )}
            {error && (
                <div className="banner error" role="alert">
                    <span>{t.routeLoadError}</span>
                    <button className="text-button" onClick={retry}>
                        {t.retryRoute}
                    </button>
                </div>
            )}
            {!loading && !error && !currentRoute.stops.length && (
                <p className="banner">{t.noDirectionStops}</p>
            )}
            <div className="stop-list">
                {itinerary.entries.map(({ id, seq, route: stopRoute }, index) => {
                    const stop = itinerary.stops[id]
                    if (!stop) return null
                    const key = `${id}:${seq}`,
                        expanded = selectedStop === key
                    const saved = user.bookmarks.some(
                        (b) => b.routeId === stopRoute.id && b.stopId === id && b.seq === seq,
                    )
                    return (
                        <article key={key} className={`stop-row ${expanded ? 'expanded' : ''}`}>
                            <button
                                className="stop-main"
                                onClick={() => setSelectedStop(expanded ? null : key)}
                                aria-expanded={expanded}
                            >
                                <span className="stop-sequence">{index + 1}</span>
                                <span>
                                    <strong>{stop.name[lang]}</strong>
                                    <small>{stop.name[tc ? 'en' : 'tc']}</small>
                                </span>
                                <ChevronRight size={18} />
                            </button>
                            {expanded && (
                                <div className="stop-expanded">
                                    <ArrivalPanel
                                        key={`${currentRoute.id}:${key}:${lang}`}
                                        route={stopRoute}
                                        knownStops={itinerary.stops}
                                        stop={stop}
                                        seq={seq}
                                        lang={lang}
                                        t={t}
                                    />
                                    <button
                                        className="text-button full"
                                        onClick={() => bookmark(stopRoute, stop, seq)}
                                    >
                                        <BookmarkIcon
                                            size={17}
                                            fill={saved ? 'currentColor' : 'none'}
                                        />
                                        {saved ? t.savedStop : t.save}
                                    </button>
                                </div>
                            )}
                        </article>
                    )
                })}
            </div>
            <p className="footnote">{t.minuteRefresh}</p>
        </>
    )
}
