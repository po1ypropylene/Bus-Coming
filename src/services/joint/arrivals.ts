import type { ArrivalResult, Lang, Route, Stop } from '../../types/transit'
import { getArrivals } from '../api'
import { loadRouteDetails } from '../catalog/routeDetails'
import { matchJointStop } from './matching'

export async function getJointArrivals(
    route: Route,
    stop: Stop,
    seq: number,
    lang: Lang,
    downloadedStops: Record<string, Stop>,
): Promise<ArrivalResult> {
    if (!route.jointPartners?.length) return getArrivals(route, stop, seq, lang)
    const primary = { ...route, jointPartners: undefined }
    const sources = [primary, ...route.jointPartners]
    const results = await Promise.allSettled(
        sources.map(async (source, index) => {
            let selected = source,
                selectedStop = stop,
                selectedSeq = seq
            if (index > 0) {
                let stops = { ...downloadedStops, [stop.id]: stop }
                if (!source.stops.length || source.stops.some((s) => !stops[s.id])) {
                    const details = await loadRouteDetails(source)
                    selected = details.route
                    stops = { ...stops, ...details.stops }
                }
                const link = matchJointStop(primary, selected, stop.id, seq, stops)
                if (!link) throw new Error('Partner stop cannot be safely matched')
                selectedStop = stops[link.id]
                selectedSeq = link.seq
            }
            const result = await getArrivals(selected, selectedStop, selectedSeq, lang)
            return {
                ...result,
                arrivals: result.arrivals.map((a) => ({ ...a, provider: source.provider })),
            }
        }),
    )
    const available = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
    )
    if (!available.length) throw new Error('All operator arrivals unavailable')
    return {
        arrivals: available
            .flatMap((result) => result.arrivals)
            .sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity)),
        fetchedAt: Math.min(...available.map((result) => result.fetchedAt)),
        partial: available.length !== sources.length,
    }
}
