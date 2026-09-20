import type { ArrivalResult, Lang, Route, Stop } from '../types/transit'
import { hkTime, selectArrivals, selectCitybusArrivals } from '../utils/transit'

export const BASE = {
    KMB: 'https://data.etabus.gov.hk/v1/transport/kmb',
    CTB: 'https://rt.data.gov.hk/v2/transport/citybus',
    NLB: 'https://rt.data.gov.hk/v2/transport/nlb',
}

export async function request(url: string): Promise<unknown> {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(25000),
                cache: 'no-store',
            })
            if (!response.ok) {
                if (response.status !== 429 && response.status < 500)
                    throw new Error(`HTTP ${response.status}`)
                const retry = Math.min(
                    15000,
                    Number(response.headers.get('Retry-After')) * 1000 || 1000 * 2 ** attempt,
                )
                await new Promise((resolve) => setTimeout(resolve, retry))
                throw new Error(`HTTP ${response.status}`)
            }
            return await response.json()
        } catch (error) {
            if (attempt === 2) throw error
            await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** attempt))
        }
    }
    throw new Error('Network unavailable')
}

const inflight = new Map<string, Promise<ArrivalResult>>()
const recent = new Map<string, ArrivalResult>()

export function getArrivals(
    route: Route,
    stop: Stop,
    seq: number,
    lang: Lang,
): Promise<ArrivalResult> {
    const key = `${route.id}:${stop.id}:${seq}:${lang}`
    const cached = recent.get(key)
    if (cached && Date.now() - cached.fetchedAt < 15000) return Promise.resolve(cached)
    if (inflight.has(key)) return inflight.get(key)!
    const work = (async () => {
        const url =
            route.provider === 'KMB'
                ? `${BASE.KMB}/eta/${stop.code}/${route.number}/${route.service}`
                : route.provider === 'CTB'
                  ? `${BASE.CTB}/eta/CTB/${stop.code}/${route.number}`
                  : `${BASE.NLB}/stop.php?action=estimatedArrivals&routeId=${route.service}&stopId=${stop.code}&language=${lang === 'tc' ? 'zh' : 'en'}`
        const data = (await request(url)) as {
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
