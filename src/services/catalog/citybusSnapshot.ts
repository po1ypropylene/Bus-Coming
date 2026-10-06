import type { Snapshot } from '../../types/transit'
import { WEEK } from '../../types/transit'
import { makeSnapshot } from '../../utils/transit'

export interface CitybusManifest {
    schemaVersion: 1
    updatedAt: number
    file: string
    sha256: string
    bytes: number
}

export function validateManifest(input: unknown): CitybusManifest {
    const value = input as CitybusManifest
    if (
        !value ||
        value.schemaVersion !== 1 ||
        !Number.isSafeInteger(value.updatedAt) ||
        value.updatedAt <= 0 ||
        value.updatedAt > Date.now() + 5 * 60 * 1000 ||
        !/^snapshot-[a-f0-9]{64}\.json$/.test(value.file) ||
        !/^[a-f0-9]{64}$/.test(value.sha256) ||
        value.file !== `snapshot-${value.sha256}.json` ||
        !Number.isSafeInteger(value.bytes) ||
        value.bytes <= 0 ||
        value.bytes > 24 * 1024 * 1024
    )
        throw new Error('Invalid Citybus manifest')
    return value
}

export function validateCitybusSnapshot(input: unknown, updatedAt: number): Snapshot {
    const value = input as Snapshot & { schemaVersion: number }
    const text = (name: { en: string; tc: string }) =>
        name && typeof name.en === 'string' && !!name.en && typeof name.tc === 'string' && !!name.tc
    if (
        !value ||
        value.schemaVersion !== 1 ||
        value.provider !== 'CTB' ||
        value.updatedAt !== updatedAt ||
        !Array.isArray(value.routes) ||
        !value.routes.length ||
        !value.stops ||
        typeof value.stops !== 'object' ||
        Array.isArray(value.stops)
    )
        throw new Error('Invalid Citybus snapshot')
    for (const [id, stop] of Object.entries(value.stops)) {
        if (
            !stop ||
            stop.provider !== 'CTB' ||
            typeof stop.code !== 'string' ||
            !/^\d{6}$/.test(stop.code) ||
            id !== `CTB:${stop.code}` ||
            stop.id !== id ||
            !text(stop.name) ||
            !Number.isFinite(stop.lat) ||
            Math.abs(stop.lat) > 90 ||
            !Number.isFinite(stop.lng) ||
            Math.abs(stop.lng) > 180
        )
            throw new Error('Invalid Citybus stop')
    }
    const ids = new Set<string>()
    for (const route of value.routes) {
        if (
            !route ||
            route.provider !== 'CTB' ||
            typeof route.number !== 'string' ||
            !/^[A-Z0-9-]+$/.test(route.number) ||
            !['O', 'I'].includes(route.bound) ||
            route.service !== '1' ||
            route.id !== `CTB:${route.number}:${route.bound}:1` ||
            ids.has(route.id) ||
            !text(route.origin) ||
            !text(route.destination) ||
            !Array.isArray(route.stops) ||
            !route.stops.length ||
            route.jointPartners
        )
            throw new Error('Invalid Citybus route')
        ids.add(route.id)
        let previous = 0
        for (const stop of route.stops) {
            if (
                !stop ||
                !Number.isSafeInteger(stop.seq) ||
                stop.seq <= previous ||
                !Object.hasOwn(value.stops, stop.id)
            )
                throw new Error('Invalid Citybus relationship')
            previous = stop.seq
        }
    }
    // Rebuild the derived index; never trust a downloaded reverse index.
    return { ...makeSnapshot('CTB', value.routes, value.stops), updatedAt }
}

export async function fetchCitybusSnapshot(
    manifestUrl: string,
    previous?: Snapshot,
): Promise<Snapshot> {
    const response = await fetch(manifestUrl, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error(`Citybus manifest HTTP ${response.status}`)
    const manifest = validateManifest(await response.json())
    if (Date.now() - manifest.updatedAt >= WEEK)
        throw new Error('Shared Citybus snapshot is overdue')
    if (previous && previous.updatedAt >= manifest.updatedAt) return previous
    const payload = await fetch(new URL(manifest.file, new URL(manifestUrl, location.href)), {
        signal: AbortSignal.timeout(30000),
    })
    if (!payload.ok) throw new Error(`Citybus snapshot HTTP ${payload.status}`)
    // Bound memory even if a broken host returns an oversized or HTML fallback response.
    const reader = payload.body?.getReader()
    if (!reader) throw new Error('Missing Citybus snapshot body')
    const chunks: Uint8Array[] = []
    let bytes = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            bytes += value.byteLength
            if (bytes > manifest.bytes) throw new Error('Citybus snapshot size mismatch')
            chunks.push(value)
        }
    } finally {
        await reader.cancel()
    }
    if (bytes !== manifest.bytes) throw new Error('Citybus snapshot size mismatch')
    const data = new Uint8Array(bytes)
    let offset = 0
    for (const chunk of chunks) {
        data.set(chunk, offset)
        offset += chunk.byteLength
    }
    const digest = await crypto.subtle.digest('SHA-256', data)
    const hash = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
    if (hash !== manifest.sha256) throw new Error('Citybus snapshot checksum mismatch')
    return validateCitybusSnapshot(JSON.parse(new TextDecoder().decode(data)), manifest.updatedAt)
}
