import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Route, Stop } from '../types/transit'

const route: Route = {
    id: 'CTB:720:O:1',
    provider: 'CTB',
    number: '720',
    bound: 'O',
    service: '1',
    origin: { en: 'Origin', tc: '起點' },
    destination: { en: 'Destination', tc: '終點' },
    stops: [{ id: 'CTB:003155', seq: 1 }],
}
const stop: Stop = {
    id: 'CTB:003155',
    code: '003155',
    provider: 'CTB',
    name: route.origin,
    lat: 22.3,
    lng: 114.2,
}
const response = (count: number) =>
    new Response(
        JSON.stringify({
            data: Array.from({ length: count }, (_, i) => ({
                co: 'CTB',
                route: '720',
                dir: 'O',
                stop: stop.code,
                seq: 1,
                eta_seq: i + 2,
                eta: new Date(Date.now() + (i + 1) * 300000).toISOString(),
            })),
        }),
    )

beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T08:36:00+08:00'))
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

it('keeps the automatic cache but fetches immediately for manual refresh', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(2)).mockResolvedValueOnce(response(3))
    vi.stubGlobal('fetch', fetch)
    const { getArrivals } = await import('./api')
    const initial = await getArrivals(route, stop, 1, 'en')
    expect(initial.arrivals).toHaveLength(2)
    vi.advanceTimersByTime(1000)
    expect(await getArrivals(route, stop, 1, 'en')).toBe(initial)
    expect(fetch).toHaveBeenCalledOnce()
    const refreshed = await getArrivals(route, stop, 1, 'en', { forceRefresh: true })
    expect(refreshed.arrivals).toHaveLength(3)
    expect(refreshed.fetchedAt).toBe(Date.now())
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(await getArrivals(route, stop, 1, 'en')).toBe(refreshed)
})

it('shares an active forced refresh instead of returning the older cached response', async () => {
    let resolve!: (value: Response) => void
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(response(2))
        .mockImplementationOnce(() => new Promise<Response>((done) => (resolve = done)))
    vi.stubGlobal('fetch', fetch)
    const { getArrivals } = await import('./api')
    await getArrivals(route, stop, 1, 'en')
    const refresh = getArrivals(route, stop, 1, 'en', { forceRefresh: true })
    const concurrent = getArrivals(route, stop, 1, 'en', { forceRefresh: true })
    const automatic = getArrivals(route, stop, 1, 'en')
    expect(concurrent).toBe(refresh)
    expect(automatic).toBe(refresh)
    resolve(response(3))
    expect((await automatic).arrivals).toHaveLength(3)
    expect(fetch).toHaveBeenCalledTimes(2)
})

it('expires automatic cache entries at 15 seconds', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(2)).mockResolvedValueOnce(response(3))
    vi.stubGlobal('fetch', fetch)
    const { getArrivals } = await import('./api')
    await getArrivals(route, stop, 1, 'en')
    vi.advanceTimersByTime(15000)
    expect((await getArrivals(route, stop, 1, 'en')).arrivals).toHaveLength(3)
    expect(fetch).toHaveBeenCalledTimes(2)
})
