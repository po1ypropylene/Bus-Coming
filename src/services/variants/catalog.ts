import { db } from '../../storage/catalogDb'
import { type CatalogEvent, WEEK } from '../../types/transit'
import { parseGtfs } from './gtfs'
import type { VariantCatalog } from './types'

export const VARIANT_CACHE_KEY = 'td-citybus-variants-v1'
export const GTFS_BASE = 'https://static.data.gov.hk/td/pt-headway-'

export function cachedVariantCatalog(input: unknown): VariantCatalog | null {
    const c = input as VariantCatalog
    const text = (v: { en: string; tc: string }) =>
        v && typeof v.en === 'string' && !!v.en && typeof v.tc === 'string' && !!v.tc
    if (
        !c ||
        c.schema !== 1 ||
        !Number.isSafeInteger(c.updatedAt) ||
        c.updatedAt <= 0 ||
        c.updatedAt > Date.now() + 300000 ||
        !Array.isArray(c.variants) ||
        !c.variants.length ||
        !c.stops ||
        !c.calendars
    )
        return null
    const ids = new Set<string>()
    try {
        for (const [id, s] of Object.entries(c.stops)) {
            if (
                s.id !== id ||
                !text(s.name) ||
                !Number.isFinite(s.lat) ||
                Math.abs(s.lat) > 90 ||
                !Number.isFinite(s.lng) ||
                Math.abs(s.lng) > 180
            )
                return null
        }
        for (const [id, v] of Object.entries(c.calendars)) {
            if (
                v.id !== id ||
                !/^\d{8}$/.test(v.start) ||
                !/^\d{8}$/.test(v.end) ||
                !Array.isArray(v.days) ||
                !v.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) ||
                !v.exceptions ||
                !Object.entries(v.exceptions).every(
                    ([date, active]) => /^\d{8}$/.test(date) && typeof active === 'boolean',
                )
            )
                return null
        }
        for (const v of c.variants) {
            if (
                !/^TD:\d+:\d+$/.test(v.id) ||
                ids.has(v.id) ||
                !/^[A-Z0-9]+$/.test(v.number) ||
                !text(v.name) ||
                !Array.isArray(v.stops) ||
                v.stops.length < 2 ||
                !v.stops.every((id) => Object.hasOwn(c.stops, id)) ||
                !Array.isArray(v.departures) ||
                !v.departures.length ||
                !v.departures.every(
                    (p) =>
                        Object.hasOwn(c.calendars, p.calendar) &&
                        Number.isInteger(p.start) &&
                        p.start >= 0 &&
                        Number.isInteger(p.end) &&
                        p.end >= p.start &&
                        p.end < 48 * 3600 &&
                        Number.isInteger(p.headway) &&
                        p.headway >= 0 &&
                        (p.headway > 0 || p.start === p.end),
                )
            )
                return null
            ids.add(v.id)
        }
    } catch {
        return null
    }
    return c
}

async function downloadFile(url: string, max: number) {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(60000) })
    if (!response.ok || !response.body) throw new Error(`Timetable HTTP ${response.status}`)
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
        for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > max) throw new Error('Oversized timetable download')
            chunks.push(value)
        }
    } finally {
        await reader.cancel()
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
    }
    return bytes
}

export async function downloadVariantCatalog(force: boolean, emit: (event: CatalogEvent) => void) {
    const database = await db()
    try {
        const cached = cachedVariantCatalog(
            (await database.get('responses', VARIANT_CACHE_KEY))?.data,
        )
        if (cached) emit({ type: 'variants', catalog: cached })
        if (cached && !force && Date.now() - cached.updatedAt < WEEK) return
        // Only English ZIP tables needed for Citybus are inflated. Chinese labels
        // are small standalone tables; fare tables never occupy worker memory.
        const [archive, names, stops] = await Promise.all([
            downloadFile(`${GTFS_BASE}en/gtfs.zip`, 20 * 1024 * 1024),
            downloadFile(`${GTFS_BASE}tc/routes.txt`, 2 * 1024 * 1024),
            downloadFile(`${GTFS_BASE}tc/stops.txt`, 4 * 1024 * 1024),
        ])
        const decoder = new TextDecoder()
        const catalog = cachedVariantCatalog(
            parseGtfs(archive, decoder.decode(names), decoder.decode(stops)),
        )
        if (!catalog) throw new Error('Invalid Citybus timetable')
        await database.put(
            'responses',
            { at: catalog.updatedAt, generation: 1, data: catalog },
            VARIANT_CACHE_KEY,
        )
        emit({ type: 'variants', catalog })
    } finally {
        database.close()
    }
}
