import { oppositeRoute } from '../utils/routeDirection'
import { ArrowLeft, ArrowRightLeft } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { useMemo } from 'react'
import { RouteStopList, type DisplayStop } from '../components/routes/RouteStopList'
import { VariantPicker } from '../components/routes/VariantPicker'
import { useRouteVariants } from '../hooks/useRouteVariants'
import { RouteBadge } from '../components/routes/RouteBadge'
import { useJointItinerary } from '../hooks/useJointItinerary'
import { useRouteDetails } from '../hooks/useRouteDetails'
import { routeCompany } from '../i18n'
import type { Route } from '../types/transit'

export function RouteDetailsPage() {
    const { currentRoute: selectedRoute } = useApp()
    if (!selectedRoute) return null
    return <RouteDetails key={selectedRoute.id} route={selectedRoute} />
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
        selectedStop,
        stops: downloadedStops,
        variantCatalog,
        jointCatalog,
    } = useApp()
    const {
        route: currentRoute,
        stops,
        loading,
        error,
        retry,
    } = useRouteDetails(route, downloadedStops)
    const reverse = oppositeRoute(route, byRoute.values())
    const otherDetails = useRouteDetails(reverse ?? route, downloadedStops)
    const family = useMemo(
        () => (reverse ? [currentRoute, otherDetails.route] : [currentRoute]),
        [currentRoute, otherDetails.route, reverse],
    )
    const knownStops = useMemo(
        () => ({ ...downloadedStops, ...stops, ...otherDetails.stops }),
        [downloadedStops, stops, otherDetails.stops],
    )
    const variants = useRouteVariants(
        currentRoute,
        family,
        knownStops,
        variantCatalog,
        selectedStop,
        jointCatalog?.numbers,
    )
    const itinerary = useJointItinerary(currentRoute, stops, downloadedStops)
    const displayStops: DisplayStop[] = variants.selected
        ? variants.selected.entries.map(({ stop, api }, index) => ({
              key: api ? `${api.stop.id}:${api.seq}` : `TD:${stop.id}:${index}`,
              stop: api?.stop ?? { ...stop, id: `TD:${stop.id}`, code: stop.id, provider: 'CTB' },
              api,
          }))
        : itinerary.entries.flatMap(({ id, seq, route: stopRoute }) =>
              itinerary.stops[id]
                  ? [
                        {
                            key: `${id}:${seq}`,
                            stop: itinerary.stops[id],
                            api: { route: stopRoute, stop: itinerary.stops[id], seq },
                        },
                    ]
                  : [],
          )
    const first = variants.selected?.entries[0]
    const last = variants.selected?.entries.at(-1)
    const origin = first ? (first.api?.stop.name ?? first.stop.name) : currentRoute.origin
    const destination = last ? (last.api?.stop.name ?? last.stop.name) : currentRoute.destination
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
                    <h1>
                        {t.toward} {destination[lang]}
                    </h1>
                    <p>
                        {t.from} {origin[lang]}
                    </p>
                </div>
                {reverse && (
                    <button
                        className="text-button direction-switch"
                        onClick={() => openRoute(reverse)}
                        aria-label={`${t.flipDirection}: ${reverse.destination[lang]}`}
                        title={`${t.flipDirection}: ${reverse.destination[lang]}`}
                    >
                        <ArrowRightLeft size={18} />
                        <span>
                            {t.flipDirection}
                            <small>
                                {t.toward} {reverse.destination[lang]}
                            </small>
                        </span>
                    </button>
                )}
            </section>
            {currentRoute.provider === 'CTB' && <VariantPicker state={variants} />}
            <div className="section-heading">
                <h2>{t.routeStops}</h2>
                <span>
                    {displayStops.length} {t.stops}
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
            <RouteStopList
                entries={displayStops}
                stops={variants.selected ? knownStops : itinerary.stops}
            />
            <p className="footnote">{t.minuteRefresh}</p>
        </>
    )
}
