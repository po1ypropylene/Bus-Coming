import { strFromU8, unzipSync } from 'fflate'
import type { DeparturePeriod, RouteVariant, VariantCatalog } from './types'

// Iterate records rather than splitting the 50 MB stop-times file into an array.
// CSV names can contain quoted commas, escaped quotes and embedded newlines.
export function* csvRecords(text: string): Generator<Record<string, string>> {
    let fields: string[] = [],
        field = '',
        quoted = false
    let headers: string[] | undefined
    for (let i = 0; i <= text.length; i++) {
        const char = text[i] ?? '\n'
        if (char === '"') {
            if (quoted && text[i + 1] === '"') {
                field += '"'
                i++
            } else quoted = !quoted
        } else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
            fields.push(field)
            field = ''
            if (char === ',') continue
            if (char === '\r' && text[i + 1] === '\n') i++
            if (fields.some(Boolean)) {
                if (!headers) headers = fields.map((h) => h.replace(/^\uFEFF/, ''))
                else {
                    if (fields.length !== headers.length) throw new Error('Invalid GTFS CSV')
                    yield Object.fromEntries(headers.map((h, j) => [h, fields[j]]))
                }
            }
            fields = []
        } else field += char
    }
    if (quoted) throw new Error('Unterminated GTFS CSV')
}

export function seconds(value: string) {
    if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) throw new Error('Invalid GTFS time')
    const [h, m, s] = value.split(':').map(Number)
    if (h > 47 || m > 59 || s > 59) throw new Error('Invalid GTFS time')
    return h * 3600 + m * 60 + s
}

function citybusName(value: string) {
    return (
        value
            .split('|')
            .find((v) => v.startsWith('[CTB]'))
            ?.replace(/^\[CTB\]\s*/, '') || value
    )
}

function patternId(value: string) {
    let hash = 2166136261
    for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
    return hash >>> 0
}

export function parseGtfs(
    archive: Uint8Array,
    chineseRoutes: string,
    chineseStops: string,
): VariantCatalog {
    const needed = new Set([
        'routes.txt',
        'stops.txt',
        'trips.txt',
        'stop_times.txt',
        'frequencies.txt',
        'calendar.txt',
        'calendar_dates.txt',
    ])
    const files = unzipSync(archive, {
        filter: (file) => {
            if (!needed.has(file.name)) return false
            if (file.originalSize > 60 * 1024 * 1024) throw new Error('Oversized GTFS table')
            return true
        },
    })
    const records = (name: string) => {
        if (!files[name]) throw new Error(`Missing GTFS table: ${name}`)
        return csvRecords(strFromU8(files[name]))
    }
    const localizedRoutes = new Map([...csvRecords(chineseRoutes)].map((r) => [r.route_id, r]))
    const routes = new Map(
        [...records('routes.txt')]
            .filter((r) => r.agency_id.split('+').includes('CTB'))
            .map((r) => [r.route_id, r]),
    )
    if (!routes.size) throw new Error('Empty Citybus timetable')
    const trips = new Map(
        [...records('trips.txt')].filter((r) => routes.has(r.route_id)).map((r) => [r.trip_id, r]),
    )
    const links = new Map<string, { id: string; seq: number; departure: string }[]>()
    for (const row of records('stop_times.txt')) {
        if (!trips.has(row.trip_id)) continue
        const list = links.get(row.trip_id) ?? []
        list.push({
            id: row.stop_id,
            seq: Number(row.stop_sequence),
            departure: row.departure_time,
        })
        links.set(row.trip_id, list)
    }
    const periods = new Map<string, DeparturePeriod[]>()
    for (const row of records('frequencies.txt')) {
        const trip = trips.get(row.trip_id)
        if (!trip) continue
        const list = periods.get(row.trip_id) ?? []
        list.push({
            calendar: trip.service_id,
            start: seconds(row.start_time),
            end: seconds(row.end_time),
            headway: Number(row.headway_secs),
        })
        periods.set(row.trip_id, list)
    }
    const patterns = new Map<string, RouteVariant>()
    for (const [id, trip] of trips) {
        const route = routes.get(trip.route_id)!
        const tc = localizedRoutes.get(trip.route_id)
        const stops = links.get(id)?.sort((a, b) => a.seq - b.seq)
        if (!tc || !stops || stops.length < 2 || !stops[0].departure)
            throw new Error('Incomplete GTFS trip')
        const key = `${trip.route_id}:${stops.map((s) => s.id).join(',')}`
        let variant = patterns.get(key)
        if (!variant) {
            variant = {
                id: `TD:${trip.route_id}:${patternId(key)}`,
                number: route.route_short_name,
                name: { en: route.route_long_name, tc: tc.route_long_name },
                stops: stops.map((s) => s.id),
                departures: [],
            }
            patterns.set(key, variant)
        }
        const start = seconds(stops[0].departure)
        variant.departures.push(
            ...(periods.get(id) ?? [{ calendar: trip.service_id, start, end: start, headway: 0 }]),
        )
    }
    const catalog: VariantCatalog = {
        schema: 1,
        updatedAt: Date.now(),
        variants: [...patterns.values()],
        stops: {},
        calendars: {},
    }
    const usedStops = new Set(catalog.variants.flatMap((v) => v.stops))
    const localizedStops = new Map(
        [...csvRecords(chineseStops)]
            .filter((r) => usedStops.has(r.stop_id))
            .map((r) => [r.stop_id, r]),
    )
    for (const row of records('stops.txt')) {
        if (!usedStops.has(row.stop_id)) continue
        const tc = localizedStops.get(row.stop_id)
        if (!tc) throw new Error('Missing Chinese stop')
        catalog.stops[row.stop_id] = {
            id: row.stop_id,
            name: { en: citybusName(row.stop_name), tc: citybusName(tc.stop_name) },
            lat: Number(row.stop_lat),
            lng: Number(row.stop_lon),
        }
    }
    const usedCalendars = new Set(
        catalog.variants.flatMap((v) => v.departures.map((d) => d.calendar)),
    )
    for (const row of records('calendar.txt')) {
        if (!usedCalendars.has(row.service_id)) continue
        catalog.calendars[row.service_id] = {
            id: row.service_id,
            days: [
                'sunday',
                'monday',
                'tuesday',
                'wednesday',
                'thursday',
                'friday',
                'saturday',
            ].flatMap((day, i) => (row[day] === '1' ? [i] : [])),
            start: row.start_date,
            end: row.end_date,
            exceptions: {},
        }
    }
    for (const row of records('calendar_dates.txt')) {
        if (!usedCalendars.has(row.service_id)) continue
        const calendar = (catalog.calendars[row.service_id] ??= {
            id: row.service_id,
            days: [],
            start: row.date,
            end: row.date,
            exceptions: {},
        })
        calendar.exceptions[row.date] = row.exception_type === '1'
    }
    return catalog
}
