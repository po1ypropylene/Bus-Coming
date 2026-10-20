import { beforeEach, expect, it, vi } from 'vitest'
import { downloadVariantCatalog, VARIANT_CACHE_KEY } from './catalog'
import { parseGtfs } from './gtfs'
import { timetableFixture } from './fixtures'
import { WEEK, type CatalogEvent } from '../../types/transit'

const { cache, put } = vi.hoisted(() => ({ cache: new Map<string, unknown>(), put: vi.fn() }))
vi.mock('../../storage/catalogDb', () => ({
    db: async () => ({
        get: async (_store: string, key: string) => cache.get(key),
        put: async (_store: string, value: unknown, key: string) => {
            put()
            cache.set(key, value)
        },
        close: vi.fn(),
    }),
}))
vi.mock('./gtfs', () => ({ parseGtfs: vi.fn() }))
beforeEach(() => {
    cache.clear()
    vi.clearAllMocks()
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('fixture')),
    )
})
it('keeps fresh cached timetables and supports forced and weekly refresh', async () => {
    const catalog = timetableFixture()
    cache.set(VARIANT_CACHE_KEY, { data: catalog })
    const events: CatalogEvent[] = []
    await downloadVariantCatalog(false, (e) => events.push(e))
    expect(events).toEqual([{ type: 'variants', catalog }])
    expect(fetch).not.toHaveBeenCalled()
    vi.mocked(parseGtfs).mockReturnValue(catalog)
    await downloadVariantCatalog(true, vi.fn())
    expect(fetch).toHaveBeenCalledTimes(3)
    cache.set(VARIANT_CACHE_KEY, { data: { ...catalog, updatedAt: Date.now() - WEEK - 1 } })
    await downloadVariantCatalog(false, vi.fn())
    expect(fetch).toHaveBeenCalledTimes(6)
})
it('does not replace saved data on HTTP, parse or validation failure', async () => {
    const previous = { data: timetableFixture() }
    cache.set(VARIANT_CACHE_KEY, previous)
    vi.mocked(fetch).mockResolvedValue(new Response('unavailable', { status: 503 }))
    await expect(downloadVariantCatalog(true, vi.fn())).rejects.toThrow('HTTP')
    vi.mocked(fetch).mockImplementation(async () => new Response('fixture'))
    vi.mocked(parseGtfs).mockImplementation(() => {
        throw new Error('incomplete')
    })
    await expect(downloadVariantCatalog(true, vi.fn())).rejects.toThrow('incomplete')
    vi.mocked(parseGtfs).mockReturnValue({ ...timetableFixture(), variants: [] })
    await expect(downloadVariantCatalog(true, vi.fn())).rejects.toThrow('Invalid')
    expect(cache.get(VARIANT_CACHE_KEY)).toBe(previous)
    expect(put).not.toHaveBeenCalled()
})
