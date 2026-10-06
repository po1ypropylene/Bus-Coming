import { beforeEach, expect, it, vi } from 'vitest'
import { download } from './download'
import { fetchCitybusSnapshot } from './citybusSnapshot'
import { downloadCitybus } from './citybus'
import { makeSnapshot } from '../../utils/transit'
import { WEEK } from '../../types/transit'

const { stores, put, close } = vi.hoisted(() => ({
    stores: new Map<string, unknown>(),
    put: vi.fn(),
    close: vi.fn(),
}))
vi.mock('../../storage/catalogDb', () => ({
    db: async () => ({
        get: async (store: string, key: string) => stores.get(`${store}:${key}`),
        put: async (store: string, value: unknown, key?: string) => {
            put(store, value, key)
            stores.set(`${store}:${key ?? (value as { provider: string }).provider}`, value)
        },
        transaction: () => ({ store: { openCursor: async () => null }, done: Promise.resolve() }),
        close,
    }),
}))
vi.mock('./citybusSnapshot', () => ({ fetchCitybusSnapshot: vi.fn() }))
vi.mock('./citybus', () => ({ downloadCitybus: vi.fn() }))
const stop = {
    id: 'CTB:001234',
    code: '001234',
    provider: 'CTB' as const,
    name: { en: 'Stop', tc: '站' },
    lat: 22.3,
    lng: 114.2,
}
const route = {
    id: 'CTB:2X:I:1',
    number: '2X',
    provider: 'CTB' as const,
    bound: 'I' as const,
    service: '1',
    origin: stop.name,
    destination: stop.name,
    stops: [{ id: stop.id, seq: 1 }],
}
const snapshot = () => makeSnapshot('CTB', [structuredClone(route)], { [stop.id]: stop })
beforeEach(() => {
    stores.clear()
    vi.clearAllMocks()
    vi.stubEnv('VITE_CITYBUS_CATALOG_URL', 'https://data.example/manifest.json')
})
it('commits a shared snapshot without crawling and leaves user data outside the transaction', async () => {
    const shared = snapshot()
    vi.mocked(fetchCitybusSnapshot).mockResolvedValue(shared)
    const emit = vi.fn()
    await download('CTB', false, emit)
    expect(stores.get('snapshots:CTB')).toBe(shared)
    expect(downloadCitybus).not.toHaveBeenCalled()
    expect(put).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith({ type: 'snapshot', snapshot: shared })
    expect(close).toHaveBeenCalledOnce()
})
it('checks weekly and checks a fresh snapshot on manual refresh', async () => {
    const shared = snapshot()
    stores.set('snapshots:CTB', shared)
    vi.mocked(fetchCitybusSnapshot).mockResolvedValue(shared)
    await download('CTB', false, vi.fn())
    expect(fetchCitybusSnapshot).not.toHaveBeenCalled()
    await download('CTB', true, vi.fn())
    expect(fetchCitybusSnapshot).toHaveBeenCalledOnce()
    shared.updatedAt -= WEEK + 1
    await download('CTB', false, vi.fn())
    expect(fetchCitybusSnapshot).toHaveBeenCalledTimes(2)
})
it('falls back to the checkpointed official importer if the shared host is unavailable', async () => {
    vi.mocked(fetchCitybusSnapshot).mockRejectedValue(new Error('Unavailable'))
    vi.mocked(downloadCitybus).mockResolvedValue({ routes: [route], stops: { [stop.id]: stop } })
    await download('CTB', true, vi.fn())
    expect(downloadCitybus).toHaveBeenCalledOnce()
    expect(stores.get('snapshots:CTB')).toMatchObject({ routes: [route] })
})
it('preserves the previous snapshot when shared and official refreshes fail', async () => {
    const previous = snapshot()
    stores.set('snapshots:CTB', previous)
    vi.mocked(fetchCitybusSnapshot).mockRejectedValue(new Error('Invalid checksum'))
    vi.mocked(downloadCitybus).mockRejectedValue(new Error('Offline'))
    await expect(download('CTB', true, vi.fn())).rejects.toThrow('Offline')
    expect(stores.get('snapshots:CTB')).toBe(previous)
    expect(close).toHaveBeenCalledOnce()
})
