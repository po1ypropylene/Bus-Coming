import type { ArrivalResult, Lang, Route, Stop } from '../types/transit'
import { hkTime, selectArrivals, selectCitybusArrivals } from '../utils/transit'
import { requestJson } from './http'

export { requestJson as request } from './http'

export const BASE = {
    KMB: 'https://data.etabus.gov.hk/v1/transport/kmb',
    CTB: 'https://rt.data.gov.hk/v2/transport/citybus',
    NLB: 'https://rt.data.gov.hk/v2/transport/nlb',
}

export interface ArrivalRequestOptions {
    forceRefresh?: boolean
}

const inflight = new Map<string, Promise<ArrivalResult>>()
const recent = new Map<string, ArrivalResult>()

export function getArrivals(
    route: Route,
    stop: Stop,
    seq: number,
    lang: Lang,
    options?: ArrivalRequestOptions,
): Promise<ArrivalResult> {
    const key = `${route.id}:${stop.id}:${seq}:${lang}`
    // Share an active refresh even if an older completed response is still cached.
    if (inflight.has(key)) return inflight.get(key)!
    const cached = recent.get(key)
    if (!options?.forceRefresh && cached && Date.now() - cached.fetchedAt < 15000)
        return Promise.resolve(cached)
    const work = (async () => {
        const url =
            route.provider === 'KMB'
                ? `${BASE.KMB}/eta/${stop.code}/${route.number}/${route.service}`
                : route.provider === 'CTB'
                  ? `${BASE.CTB}/eta/CTB/${stop.code}/${route.number}`
                  : `${BASE.NLB}/stop.php?action=estimatedArrivals&routeId=${route.service}&stopId=${stop.code}&language=${lang === 'tc' ? 'zh' : 'en'}`
        const data = (await requestJson(url)) as {
            data?: Record<string, unknown>[]
            estimatedArrivals?: { estimatedArrivalTime: string; routeVariantName: string }[]
            message?: string
        }
        const arrivals =
            route.provider === 'NLB'
                ? (data.estimatedArrivals ?? []).map((a) => ({
                      time: hkTime(a.estimatedArrivalTime),
                      remark: a.routeVariantName || data.message || '',
                  }))
                : route.provider === 'CTB'
                  ? selectCitybusArrivals(data.data ?? [], route, stop.code, seq, lang)
                  : selectArrivals(data.data ?? [], route, seq, lang)
        if (!arrivals.length && data.message) arrivals.push({ time: null, remark: data.message })
        const result = { arrivals, fetchedAt: Date.now() }
        recent.set(key, result)
        if (recent.size > 200) recent.delete(recent.keys().next().value!)
        return result
    })().finally(() => inflight.delete(key))
    inflight.set(key, work)
    return work
}
