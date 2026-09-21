import { useEffect, useMemo, useState } from 'react'
import type { Route, RouteDetails, Stop } from '../types/transit'
import { loadRouteDetails } from '../services/catalog/routeDetails'
import { matchJointStops } from '../services/joint/matching'

// Preserve operator stop IDs in a single itinerary, including partner-only stops.
export function useJointItinerary(
    route: Route,
    primaryStops: Record<string, Stop>,
    downloadedStops: Record<string, Stop>,
) {
    const partner = route.jointPartners?.[0]
    const complete = !!partner?.stops.length && partner.stops.every((s) => downloadedStops[s.id])
    const [loaded, setLoaded] = useState<RouteDetails | null>(null)
    useEffect(() => {
        if (!partner || complete) return
        let active = true
        void loadRouteDetails(partner)
            .then((data) => {
                if (active) setLoaded(data)
            })
            .catch(() => {
                /* Arrival panel reports unavailable partner data and retries. */
            })
        return () => {
            active = false
        }
    }, [partner, complete])
    return useMemo(() => {
        const details = loaded?.id === partner?.id ? loaded : null
        const other = complete ? partner : details?.route
        const stops = { ...downloadedStops, ...primaryStops, ...details?.stops }
        const entries = route.stops.map((link, index) => ({ ...link, route, order: index }))
        if (other) {
            const pairs = matchJointStops(other, route, stops)
            const matches = other.stops.map(
                (link) => pairs.find((p) => p.a.id === link.id && p.a.seq === link.seq)?.b ?? null,
            )
            const source = { ...other, jointPartners: [{ ...route, jointPartners: undefined }] }
            other.stops.forEach((link, index) => {
                if (matches[index]) return
                // Insert between the surrounding common stops; ambiguous extra stops
                // remain available with their own operator's identity and ETA filters.
                const before = matches.slice(0, index).findLast((m) => m !== null)
                const after = matches.slice(index + 1).find((m) => m !== null)
                const left = before
                    ? route.stops.findIndex((s) => s.id === before.id && s.seq === before.seq)
                    : -1
                const right = after
                    ? route.stops.findIndex((s) => s.id === after.id && s.seq === after.seq)
                    : route.stops.length
                const order =
                    (before || after) && right > left
                        ? left + ((right - left) * (index + 1)) / (other.stops.length + 1)
                        : route.stops.length + index
                entries.push({ ...link, route: source, order })
            })
        }
        return { entries: entries.sort((a, b) => a.order - b.order), stops }
    }, [route, primaryStops, downloadedStops, partner, complete, loaded])
}
