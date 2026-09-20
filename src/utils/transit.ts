import { THEMES } from '../types/transit'
import type { Arrival, Bookmark, Route, Snapshot, Stop, UserData } from '../types/transit'

export const routeLetters = (routes: Route[]) =>
    [...new Set(routes.flatMap((r) => r.number.toUpperCase().match(/[A-Z]/g) ?? []))].sort()

export function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const rad = (n: number) => (n * Math.PI) / 180
    const x =
        Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
    return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function makeSnapshot(
    provider: Snapshot['provider'],
    routes: Route[],
    stops: Record<string, Stop>,
): Snapshot {
    const stopRoutes: Snapshot['stopRoutes'] = {}
    for (const route of routes) {
        route.stops.sort((a, b) => a.seq - b.seq)
        for (const stop of route.stops) {
            if (!stops[stop.id]) throw new Error(`Missing stop ${stop.id}`)
            ;(stopRoutes[stop.id] ??= []).push({ routeId: route.id, seq: stop.seq })
        }
    }
    return {
        provider,
        updatedAt: Date.now(),
        routes: routes.filter((r) => r.stops.length > 0),
        stops,
        stopRoutes,
    }
}

export function hkTime(value: string) {
    const normalized = value.replace(' ', 'T')
    const time = Date.parse(
        /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}+08:00`,
    )
    return Number.isFinite(time) ? time : null
}

export function selectArrivals(
    rows: Record<string, unknown>[],
    route: Route,
    seq: number,
    lang: 'en' | 'tc',
): Arrival[] {
    return rows
        .filter(
            (row) =>
                row.dir === route.bound &&
                Number(row.seq) === seq &&
                (row.service_type == null || String(row.service_type) === route.service),
        )
        .map((row) => ({
            time: row.eta ? hkTime(String(row.eta)) : null,
            remark: String(row[`rmk_${lang}`] || ''),
        }))
}

// Citybus ETA sequences may continue across directions (N8P inbound is offset by 11).
// A unique stop is unambiguous without sequence; repeated visits still require it.
export function selectCitybusArrivals(
    rows: Record<string, unknown>[],
    route: Route,
    stopCode: string,
    seq: number,
    lang: 'en' | 'tc',
): Arrival[] {
    const visits = route.stops.filter((stop) => stop.id === `CTB:${stopCode}`)
    const uniqueVisit = visits.length === 1 && visits[0].seq === seq
    return rows
        .filter(
            (row) =>
                row.dir === route.bound &&
                (row.co == null || row.co === 'CTB') &&
                (row.route == null || row.route === route.number) &&
                (row.stop == null || row.stop === stopCode) &&
                (uniqueVisit || Number(row.seq) === seq),
        )
        .map((row) => ({
            time: row.eta ? hkTime(String(row.eta)) : null,
            remark: String(row[`rmk_${lang}`] || ''),
        }))
}

export function validateUserData(input: unknown): UserData {
    if (!input || typeof input !== 'object') throw new Error('Invalid backup')
    const data = input as UserData
    if (
        data.version !== 1 ||
        (data.theme !== undefined && !THEMES.includes(data.theme)) ||
        !['en', 'tc'].includes(data.language) ||
        !Array.isArray(data.bookmarks) ||
        data.bookmarks.length > 1000
    )
        throw new Error('Invalid backup')
    const ids = new Set<string>()
    for (const b of data.bookmarks) {
        if (
            !b ||
            typeof b.id !== 'string' ||
            ids.has(b.id) ||
            typeof b.group !== 'string' ||
            b.group.length > 80 ||
            !Number.isInteger(b.seq) ||
            b.seq < 1 ||
            !b.route ||
            !b.stop ||
            b.routeId !== b.route.id ||
            b.stopId !== b.stop.id ||
            !['KMB', 'CTB', 'NLB'].includes(b.route.provider) ||
            b.route.provider !== b.stop.provider ||
            !['O', 'I'].includes(b.route.bound) ||
            typeof b.route.number !== 'string' ||
            !/^[A-Z0-9-]+$/.test(b.route.number) ||
            typeof b.route.service !== 'string' ||
            !/^[0-9]+$/.test(b.route.service) ||
            typeof b.stop.code !== 'string' ||
            !/^[A-Z0-9]+$/.test(b.stop.code) ||
            !Number.isFinite(b.stop.lat) ||
            !Number.isFinite(b.stop.lng) ||
            !Array.isArray(b.route.stops)
        )
            throw new Error('Invalid bookmark')
        for (const text of [b.route.origin, b.route.destination, b.stop.name])
            if (!text || typeof text.en !== 'string' || typeof text.tc !== 'string')
                throw new Error('Invalid name')
        ids.add(b.id)
    }
    return { ...data, theme: data.theme ?? 'green' }
}

export function resolveBookmark(bookmark: Bookmark, snapshots: Snapshot[]) {
    const snapshot = snapshots.find((s) => s.provider === bookmark.route.provider)
    if (!snapshot) return { route: bookmark.route, stop: bookmark.stop, available: true }
    const route = snapshot.routes.find((r) => r.id === bookmark.routeId)
    return {
        route: route ?? bookmark.route,
        stop: snapshot.stops[bookmark.stopId] ?? bookmark.stop,
        available: !!route?.stops.some((s) => s.id === bookmark.stopId && s.seq === bookmark.seq),
    }
}
