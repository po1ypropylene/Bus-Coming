import type { Route } from '../types/transit'
import { sameName } from '../services/joint/matching'

// Select the reverse inside the current operator's namespace. Joint partners on
// the target are already derived for that journey; never flip both operators' O/I
// codes together or reuse the current journey's partners.
function candidatesFor(route: Route, routes: Route[]): Route[] {
    return routes.filter((candidate) => {
        if (
            candidate.id === route.id ||
            candidate.provider !== route.provider ||
            candidate.number !== route.number
        )
            return false
        if (route.provider === 'NLB') {
            return (
                !sameName(route.origin, route.destination) &&
                sameName(candidate.origin, route.destination) &&
                sameName(candidate.destination, route.origin)
            )
        }
        return candidate.bound !== route.bound && candidate.service === route.service
    })
}

export function oppositeRoute(route: Route, routes: Iterable<Route>): Route | null {
    const all = [...routes]
    const candidates = candidatesFor(route, all)
    if (candidates.length) return candidates.length === 1 ? candidates[0] : null
    // A joint journey can have a return service only in the partner catalogue.
    // Only already-established partners can authorize crossing operator namespaces.
    const alternatives = (route.jointPartners ?? []).flatMap((partner) =>
        candidatesFor(partner, all),
    )
    return alternatives.length === 1 ? alternatives[0] : null
}
