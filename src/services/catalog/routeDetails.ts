import { db } from '../../storage/catalogDb'
import { type Route, type RouteDetails, WEEK } from '../../types/transit'
import { BASE, request } from '../api'
import { citybusRouteStops, citybusStops } from './citybus'
import type { Payload } from './shared'

const inflight = new Map<string, Promise<RouteDetails>>()

export function loadRouteDetails(route: Route): Promise<RouteDetails> {
    if (inflight.has(route.id)) return inflight.get(route.id)!
    const work = (async () => {
        const database = await db()
        try {
            const cached = await database.get('routeDetails', route.id)
            if (cached && (Date.now() - cached.updatedAt < WEEK || !navigator.onLine)) return cached
            if (route.provider !== 'CTB') throw new Error('Route details are not downloaded')
            const generation = (await database.get('generations', 'CTB')) ?? Date.now()

            async function get(path: string): Promise<Payload> {
                const url = BASE.CTB + path
                const cached = await database.get('responses', url)
                if (cached && cached.generation === generation) return cached.data as Payload
                const data = await request(url)
                await database.put('responses', { at: Date.now(), generation, data }, url)
                return data as Payload
            }

            const links = await citybusRouteStops(route, get)
            const stops = await citybusStops([...new Set(links.map((s) => s.id.slice(4)))], get)
            const detail = {
                id: route.id,
                updatedAt: Date.now(),
                route: { ...route, stops: links },
                stops,
            }
            await database.put('routeDetails', detail)
            return detail
        } finally {
            database.close()
        }
    })().finally(() => inflight.delete(route.id))
    inflight.set(route.id, work)
    return work
}
