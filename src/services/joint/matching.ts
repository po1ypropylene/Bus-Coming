import type { JointCatalog, Localized, Route, Stop } from '../../types/transit'
import { distance } from '../../utils/transit'

function normalize(value: string) {
    return value
        .toUpperCase()
        .replace(/\(CIRCULAR\)|（循環線）|\(循環線\)/g, '')
        .replace(/[^A-Z0-9\u3400-\u9fff]/g, '')
}

export function sameName(a: Localized, b: Localized) {
    return (['tc', 'en'] as const).some(
        (lang) => !!normalize(a[lang]) && normalize(a[lang]) === normalize(b[lang]),
    )
}

// O/I is operator-local: e.g. KMB 106 O is Citybus 106 I.
export function sameJourney(a: Route, b: Route) {
    return sameName(a.origin, b.origin) && sameName(a.destination, b.destination)
}

export function jointRoutes(
    raw: Route[],
    catalog: JointCatalog | null,
    stops: Record<string, Stop> = {},
) {
    const allowed = new Set(catalog?.numbers ?? [])
    const partners = new Map<string, Route[]>()
    const hidden = new Set<string>()
    for (const kmb of raw) {
        if (kmb.provider !== 'KMB' || kmb.service !== '1' || !allowed.has(kmb.number)) continue
        const candidates = raw.filter(
            (ctb) =>
                ctb.provider === 'CTB' &&
                ctb.number === kmb.number &&
                matchingJourney(kmb, ctb, stops),
        )
        if (candidates.length !== 1) continue
        const ctb = candidates[0]
        // Do not merge ambiguous variants sharing the same terminals.
        if (
            raw.filter(
                (r) =>
                    r.provider === 'KMB' &&
                    r.service === '1' &&
                    r.number === ctb.number &&
                    matchingJourney(r, ctb, stops),
            ).length !== 1
        )
            continue
        partners.set(kmb.id, [ctb])
        partners.set(ctb.id, [kmb])
        hidden.add(ctb.id)
    }
    const all = raw.map((route) => ({ ...route, jointPartners: partners.get(route.id) }))
    return {
        routes: all.filter((route) => !hidden.has(route.id)),
        byRoute: new Map(all.map((route) => [route.id, route])),
    }
}

// Pair only unique visits and mutual best matches along the same directed journey.
// Differently numbered sequences, nearby opposite-direction stops and loop revisits
// must never be treated as equivalent merely because they are geographically close.
export function matchJointStops(route: Route, partner: Route, stops: Record<string, Stop>) {
    const eligible = (r: Route) =>
        r.stops.filter(
            (link) =>
                stops[link.id] &&
                !stops[link.id].metadataMissing &&
                r.stops.filter((s) => s.id === link.id).length === 1,
        )
    const left = eligible(route),
        right = eligible(partner)
    const cost = (a: (typeof left)[number], b: (typeof right)[number]) => {
        const x = stops[a.id],
            y = stops[b.id]
        const meters = distance(x, y)
        if (!Number.isFinite(meters) || meters > (sameName(x.name, y.name) ? 150 : 60))
            return Infinity
        return meters
    }
    const best = (a: (typeof left)[number], list: typeof left) => {
        const ranked = list
            .map((b) => ({ link: b, score: cost(a, b) }))
            .filter((b) => Number.isFinite(b.score))
            .sort((a, b) => a.score - b.score)
        // Ties or two practically co-located alternatives are ambiguous.
        return ranked.length && (ranked.length === 1 || ranked[1].score - ranked[0].score > 10)
            ? ranked[0].link
            : undefined
    }
    const pairs = left.flatMap((a) => {
        const b = best(a, right)
        return b && best(b, left)?.id === a.id ? [{ a, b }] : []
    })
    return pairs.filter(
        (selected) =>
            !pairs.some((p) => (p.a.seq - selected.a.seq) * (p.b.seq - selected.b.seq) < 0),
    )
}

export function matchJointStop(
    route: Route,
    partner: Route,
    stopId: string,
    seq: number,
    stops: Record<string, Stop>,
) {
    return (
        matchJointStops(route, partner, stops).find((p) => p.a.id === stopId && p.a.seq === seq)
            ?.b ?? null
    )
}

function matchingJourney(a: Route, b: Route, stops: Record<string, Stop>) {
    if (sameJourney(a, b)) return true
    if (!a.stops.length || !b.stops.length) return false
    const matches = matchJointStops(a, b, stops)
    // Geometry resolves naming differences only with substantial ordered overlap.
    return matches.length >= 3 && matches.length / Math.max(a.stops.length, b.stops.length) >= 0.7
}
