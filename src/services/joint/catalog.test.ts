import { beforeEach, expect, it, vi } from 'vitest'
import { downloadJointCatalog, JOINT_CACHE_KEY } from './catalog'
import { request } from '../api'
import { type CatalogEvent, WEEK } from '../../types/transit'

const { cache, close } = vi.hoisted(() => ({ cache: new Map<string, unknown>(), close: vi.fn() }))
vi.mock('../../storage/catalogDb', () => ({
    db: async () => ({
        get: async (_store: string, key: string) => cache.get(key),
        put: async (_store: string, value: unknown, key: string) => cache.set(key, value),
        close,
    }),
}))
vi.mock('../api', () => ({ request: vi.fn() }))
const page = (number: string, more = false) => ({
    features: [{ attributes: { COMPANY_CODE: 'KMB+CTB', ROUTE_NAMEE: number } }],
    exceededTransferLimit: more,
})
beforeEach(() => {
    cache.clear()
    vi.clearAllMocks()
})

it('paginates official results and commits only the complete catalogue', async () => {
    vi.mocked(request).mockResolvedValueOnce(page('102', true)).mockResolvedValueOnce(page('106'))
    const events: CatalogEvent[] = []
    await downloadJointCatalog(false, (e) => events.push(e))
    expect(request).toHaveBeenNthCalledWith(2, expect.stringContaining('resultOffset=1'))
    expect(events[0]).toMatchObject({ type: 'joint', catalog: { numbers: ['102', '106'] } })
    expect(cache.get(JOINT_CACHE_KEY)).toMatchObject({ data: { numbers: ['102', '106'] } })
    expect(close).toHaveBeenCalledOnce()
})
it('reuses fresh data, refreshes weekly and supports explicit refresh', async () => {
    cache.set(JOINT_CACHE_KEY, { data: { updatedAt: Date.now(), numbers: ['102'] } })
    await downloadJointCatalog(false, vi.fn())
    expect(request).not.toHaveBeenCalled()
    vi.mocked(request).mockResolvedValue(page('106'))
    await downloadJointCatalog(true, vi.fn())
    expect(request).toHaveBeenCalledOnce()
    cache.set(JOINT_CACHE_KEY, { data: { updatedAt: Date.now() - WEEK - 1, numbers: ['102'] } })
    await downloadJointCatalog(false, vi.fn())
    expect(request).toHaveBeenCalledTimes(2)
})
it('keeps the last good catalogue on errors, empty results or incomplete pagination', async () => {
    const previous = { data: { updatedAt: 1, numbers: ['102'] } }
    for (const response of [
        { error: { message: 'Unavailable' } },
        { features: [] },
        { features: [], exceededTransferLimit: true },
    ]) {
        cache.set(JOINT_CACHE_KEY, previous)
        vi.mocked(request).mockResolvedValue(response)
        const events: CatalogEvent[] = []
        await expect(downloadJointCatalog(true, (e) => events.push(e))).rejects.toThrow()
        expect(events[0]).toMatchObject({ type: 'joint', catalog: previous.data })
        expect(cache.get(JOINT_CACHE_KEY)).toEqual(previous)
    }
})
