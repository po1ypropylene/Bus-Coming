import type { Route, Stop } from '../../types/transit'
import { distance } from '../../utils/transit'
import type { RouteVariant, TimetableStop, VariantCatalog } from './types'

export interface VariantEntry {
    stop: TimetableStop
    api?: { route: Route; stop: Stop; seq: number }
}

function normalize(value: string) {
    return value
        .toUpperCase()
        .replace(/<BR\s*\/?\s*>/g, '')
        .replace(/[^A-Z0-9\u3400-\u9fff]/g, '')
}

// TD and operator IDs are independent. Only unique, close physical stops can be
// paired. Preserve the complete operator route, direction and sequence for ETAs.
export function variantEntries(
    variant: RouteVariant,
    catalog: VariantCatalog,
    routes: Route[],
    stops: Record<string, Stop>,
): VariantEntry[] {
    const family = routes.filter((r) => r.provider === 'CTB' && r.number === variant.number)
    const ids = new Set(family.flatMap((r) => r.stops.map((s) => s.id)))
    const available = [...ids].map((id) => stops[id]).filter((s) => s && !s.metadataMissing)
    const mapped = variant.stops.map((id) => {
        const stop = catalog.stops[id]
        const matches = available
            .map((s) => ({ stop: s, meters: distance(stop, s) }))
            .filter(
                ({ stop: s, meters }) =>
                    meters <= 15 ||
                    (meters <= 80 &&
                        (normalize(s.name.en) === normalize(stop.name.en) ||
                            normalize(s.name.tc) === normalize(stop.name.tc))),
            )
            .sort((a, b) => a.meters - b.meters)
        const match =
            matches.length && (matches.length === 1 || matches[1].meters - matches[0].meters > 10)
                ? matches[0].stop
                : null
        const repeated =
            match && family.some((r) => r.stops.filter((s) => s.id === match.id).length > 1)
        const candidates =
            match && !repeated
                ? family.flatMap((route) => {
                      const visits = route.stops.filter((s) => s.id === match.id)
                      return visits.length === 1 ? [{ route, stop: match, seq: visits[0].seq }] : []
                  })
                : []
        return { stop, candidates }
    })
    return mapped.map(({ stop, candidates }, index) => {
        let api = candidates.length === 1 ? candidates[0] : undefined
        const before = mapped.slice(0, index).findLast((e) => e.candidates.length === 1)
            ?.candidates[0]
        const after = mapped.slice(index + 1).find((e) => e.candidates.length === 1)?.candidates[0]
        if (candidates.length > 1) {
            // Shared termini need ordered evidence from a neighbouring unique
            // visit, never a guess from TD's route bound or the selected direction.
            const ordered = candidates.filter(
                (c) =>
                    (before?.route.id === c.route.id && before.seq < c.seq) ||
                    (after?.route.id === c.route.id && after.seq > c.seq),
            )
            if (ordered.length === 1) api = ordered[0]
        }
        if (
            api &&
            ((before &&
                after &&
                before.route.id === after.route.id &&
                api.route.id !== before.route.id) ||
                (before?.route.id === api.route.id && before.seq >= api.seq) ||
                (after?.route.id === api.route.id && after.seq <= api.seq))
        )
            api = undefined
        return { stop, api }
    })
}

export function matchesDirection(entries: VariantEntry[], route: Route) {
    const links = entries.filter((e) => e.api?.route.id === route.id).map((e) => e.api!.seq)
    if (links.length < 3) return false
    // A circular pattern can include both directions; each must have ordered
    // evidence of its own. Shared route numbers or endpoint names are insufficient.
    return links.slice(1).filter((seq, i) => seq > links[i]).length >= (links.length - 1) * 0.75
}
