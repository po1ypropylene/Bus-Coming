import type { Provider, Stop } from '../../types/transit'

export type Row = Record<string, string | number>
export const name = (row: Row, prefix: string) => ({
    en: String(row[`${prefix}_en`] ?? ''),
    tc: String(row[`${prefix}_tc`] ?? ''),
})

export type Payload = { data: Row[]; routes: Row[]; stops: Row[] }

export interface CatalogClient {
    get: (path: string) => Promise<Payload>
    addTotal: (count: number) => void
}

export async function pool<T>(items: T[], task: (item: T) => Promise<void>) {
    let next = 0
    // Await every worker before reporting failure so a retry cannot race old requests.
    const results = await Promise.allSettled(
        Array.from({ length: Math.min(4, items.length) }, async () => {
            while (next < items.length) await task(items[next++])
        }),
    )
    const error = results.find((r) => r.status === 'rejected')
    if (error?.status === 'rejected') throw error.reason
}

export function stopCollector(provider: Provider) {
    const stops: Record<string, Stop> = {}

    function coordinate(value: unknown, limit: number) {
        if (
            (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) ||
            !Number.isFinite(Number(value)) ||
            Math.abs(Number(value)) > limit
        )
            throw new Error('Invalid stop data')
        return Number(value)
    }

    function addStop(row: Row) {
        const code = String(row.stop)
        if (!/^[A-Z0-9]+$/.test(code)) throw new Error('Invalid stop data')
        const stop: Stop = {
            id: `${provider}:${code}`,
            code,
            provider,
            name: name(row, 'name'),
            lat: coordinate(row.lat, 90),
            lng: coordinate(row.long, 180),
        }
        if (!stop.name.en || !stop.name.tc) throw new Error('Invalid stop data')
        stops[stop.id] = stop
    }

    return { stops, addStop }
}
