import { afterEach, expect, it, vi } from 'vitest'
import { fetchCitybusSnapshot, validateCitybusSnapshot, validateManifest } from './citybusSnapshot'
import { WEEK } from '../../types/transit'

const updatedAt = Date.now()
const stop = {
    id: 'CTB:001234',
    code: '001234',
    provider: 'CTB',
    name: { en: 'Stop', tc: '站' },
    lat: 22.3,
    lng: 114.2,
}
const route = {
    id: 'CTB:2X:I:1',
    number: '2X',
    provider: 'CTB',
    bound: 'I',
    service: '1',
    origin: { en: 'A', tc: '甲' },
    destination: { en: 'B', tc: '乙' },
    stops: [
        { id: stop.id, seq: 1 },
        { id: stop.id, seq: 3 },
    ],
}
const fixture = () => ({
    schemaVersion: 1,
    provider: 'CTB',
    updatedAt,
    routes: [structuredClone(route)],
    stops: { [stop.id]: structuredClone(stop) },
    stopRoutes: { fake: [] },
})

async function responses(value = fixture(), time = updatedAt) {
    const body = JSON.stringify(value)
    const bytes = new TextEncoder().encode(body)
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    const manifest = {
        schemaVersion: 1,
        updatedAt: time,
        file: `snapshot-${hash}.json`,
        sha256: hash,
        bytes: bytes.length,
    }
    return { manifest, body }
}

afterEach(() => vi.unstubAllGlobals())
it('preserves direction, leading zeros, repeated visits and rebuilds the reverse index', () => {
    const result = validateCitybusSnapshot(fixture(), updatedAt)
    expect(result.routes[0]).toEqual(route)
    expect(result.stops[stop.id].code).toBe('001234')
    expect(result.stopRoutes).toEqual({
        [stop.id]: [
            { routeId: route.id, seq: 1 },
            { routeId: route.id, seq: 3 },
        ],
    })
})
it('rejects missing stops, duplicate routes, invalid coordinates and unordered sequences', () => {
    const missing = fixture()
    missing.stops = {}
    const duplicate = fixture()
    duplicate.routes.push(structuredClone(route))
    const coords = fixture()
    coords.stops[stop.id].lat = 999
    const sequence = fixture()
    sequence.routes[0].stops[1].seq = 1
    for (const value of [missing, duplicate, coords, sequence])
        expect(() => validateCitybusSnapshot(value, updatedAt)).toThrow()
})
it('fetches and verifies the manifest and snapshot', async () => {
    const { manifest, body } = await responses()
    const fetcher = vi
        .fn()
        .mockResolvedValueOnce(Response.json(manifest))
        .mockResolvedValueOnce(new Response(body))
    vi.stubGlobal('fetch', fetcher)
    vi.stubGlobal('location', { href: 'https://app.example/' })
    const snapshot = await fetchCitybusSnapshot('https://data.example/manifest.json')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(snapshot.updatedAt).toBe(updatedAt)
    expect(snapshot.routes[0].bound).toBe('I')
})
it('skips unchanged payloads and never replaces a newer local snapshot', async () => {
    const { manifest } = await responses()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(manifest)))
    const previous = validateCitybusSnapshot(fixture(), updatedAt)
    expect(await fetchCitybusSnapshot('/manifest.json', previous)).toBe(previous)
})
it('rejects overdue manifests, unsafe filenames and future timestamps', async () => {
    const { manifest } = await responses()
    expect(() => validateManifest({ ...manifest, file: '../snapshot.json' })).toThrow()
    expect(() => validateManifest({ ...manifest, updatedAt: Date.now() + WEEK })).toThrow()
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(Response.json({ ...manifest, updatedAt: Date.now() - WEEK })),
    )
    await expect(fetchCitybusSnapshot('/manifest.json')).rejects.toThrow('overdue')
})
it('rejects truncated and corrupted payloads before committing', async () => {
    const { manifest, body } = await responses()
    vi.stubGlobal('location', { href: 'https://app.example/' })
    for (const broken of [body.slice(0, -1), body.replace('Stop', 'Fake')]) {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce(Response.json(manifest))
                .mockResolvedValueOnce(new Response(broken)),
        )
        await expect(fetchCitybusSnapshot('/manifest.json')).rejects.toThrow()
    }
})
