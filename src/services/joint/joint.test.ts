import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Route, Stop } from '../../types/transit'
import { cachedJointCatalog, parseJointPage } from './catalog'
import { jointRoutes, matchJointStop } from './matching'
import { getJointArrivals } from './arrivals'
import { getArrivals } from '../api'
import { loadRouteDetails } from '../catalog/routeDetails'

vi.mock('../api', () => ({ getArrivals: vi.fn(), request: vi.fn() }))
vi.mock('../catalog/routeDetails', () => ({ loadRouteDetails: vi.fn() }))
const kmb: Route = {
    id: 'KMB:106:O:1',
    number: '106',
    provider: 'KMB',
    bound: 'O',
    service: '1',
    origin: { en: 'Wong Tai Sin', tc: '黃大仙' },
    destination: { en: 'Siu Sai Wan (Island Resort)', tc: '小西灣(藍灣半島)' },
    stops: [1, 2, 3].map((seq) => ({ id: `KMB:${seq}`, seq })),
}
const ctb: Route = {
    ...kmb,
    id: 'CTB:106:I:1',
    provider: 'CTB',
    bound: 'I',
    destination: { en: 'Siu Sai Wan (Island Resort)', tc: '小西灣 (藍灣半島)' },
    stops: [1, 2, 3].map((seq) => ({ id: `CTB:${seq}`, seq: seq + 10 })),
}
const stops: Record<string, Stop> = Object.fromEntries(
    [kmb, ctb].flatMap((r) =>
        r.stops.map((s, i) => [
            s.id,
            {
                id: s.id,
                code: s.id.slice(4),
                provider: r.provider,
                name: { en: `Stop ${i}`, tc: `車站${i}` },
                lat: 22.3 + i * 0.003,
                lng: 114.17 + (r.provider === 'CTB' ? 0.00005 : 0),
            },
        ]),
    ),
)
const catalog = { updatedAt: 1, numbers: ['106'] }

describe('official joint membership and direction/stop matching', () => {
    it('parses official membership, pagination and rejects malformed/error/irrelevant data', () => {
        expect(
            parseJointPage({
                features: [{ attributes: { COMPANY_CODE: 'LWB+CTB', ROUTE_NAMEE: 'S1' } }],
                exceededTransferLimit: true,
            }),
        ).toEqual({ numbers: ['S1'], count: 1, more: true })
        for (const value of [
            null,
            {},
            { error: {} },
            { features: [{ attributes: { COMPANY_CODE: 'KMB', ROUTE_NAMEE: '2X' } }] },
        ])
            expect(() => parseJointPage(value)).toThrow()
        expect(cachedJointCatalog(catalog)).toEqual(catalog)
        expect(cachedJointCatalog({ updatedAt: 1, numbers: [] })).toBeNull()
    })
    it('merges reversed provider bounds and keeps both original IDs for old bookmarks', () => {
        const result = jointRoutes([kmb, ctb], catalog)
        expect(result.routes).toHaveLength(1)
        expect(result.byRoute.get(kmb.id)?.jointPartners?.[0].bound).toBe('I')
        expect(result.byRoute.get(ctb.id)?.jointPartners?.[0].id).toBe(kmb.id)
        expect(kmb.jointPartners).toBeUndefined()
    })
    it('never merges number collisions or special KMB services', () => {
        expect(jointRoutes([kmb, ctb], null).routes).toHaveLength(2)
        expect(
            jointRoutes(
                [kmb, ctb].map((r) => ({ ...r, number: '2X' })),
                catalog,
            ).routes,
        ).toHaveLength(2)
        expect(jointRoutes([{ ...kmb, service: '2' }, ctb], catalog).routes).toHaveLength(2)
    })
    it('resolves endpoint naming differences using substantial ordered stop overlap', () => {
        const renamed = { ...ctb, origin: { en: 'Different spelling', tc: '另一名稱' } }
        expect(jointRoutes([kmb, renamed], catalog, stops).routes).toHaveLength(1)
        expect(
            jointRoutes(
                [
                    kmb,
                    {
                        ...renamed,
                        stops: [...renamed.stops].reverse().map((s, i) => ({ ...s, seq: i + 1 })),
                    },
                ],
                catalog,
                stops,
            ).routes,
        ).toHaveLength(2)
    })
    it('uses the partner sequence instead of assuming matching sequence or bound', () => {
        expect(matchJointStop(kmb, ctb, 'KMB:2', 2, stops)).toEqual({ id: 'CTB:2', seq: 12 })
    })
    it('rejects repeated visits, remote stops, ambiguous neighbours and crossed order', () => {
        expect(
            matchJointStop(
                kmb,
                { ...ctb, stops: [...ctb.stops, { id: 'CTB:2', seq: 15 }] },
                'KMB:2',
                2,
                stops,
            ),
        ).toBeNull()
        expect(
            matchJointStop(kmb, ctb, 'KMB:2', 2, {
                ...stops,
                'CTB:2': { ...stops['CTB:2'], lat: 23 },
            }),
        ).toBeNull()
        const ambiguous = { ...ctb, stops: [...ctb.stops, { id: 'CTB:other', seq: 14 }] }
        expect(
            matchJointStop(kmb, ambiguous, 'KMB:2', 2, {
                ...stops,
                'CTB:other': { ...stops['CTB:2'], id: 'CTB:other' },
            }),
        ).toBeNull()
        const reverse = { ...ctb, stops: ctb.stops.map((s) => ({ ...s, seq: 20 - s.seq })) }
        expect(matchJointStop(kmb, reverse, 'KMB:2', 2, stops)).toBeNull()
    })
})

describe('combined arrivals', () => {
    beforeEach(() => vi.resetAllMocks())
    const joint = { ...kmb, jointPartners: [ctb] }
    it('sorts chronologically, retains operator attribution and equal-time buses', async () => {
        vi.mocked(getArrivals).mockImplementation(async (r) => ({
            fetchedAt: 100,
            arrivals: [
                { time: r.provider === 'KMB' ? 500 : 300, remark: '' },
                { time: 700, remark: '' },
            ],
        }))
        const result = await getJointArrivals(joint, stops['KMB:2'], 2, 'en', stops)
        expect(result.arrivals.map((a) => a.time)).toEqual([300, 500, 700, 700])
        expect(result.arrivals[0].provider).toBe('CTB')
        expect(getArrivals).toHaveBeenCalledWith(ctb, stops['CTB:2'], 12, 'en')
        expect(result.partial).toBe(false)
    })
    it('keeps successful arrivals when the other operator fails and reports partial data', async () => {
        vi.mocked(getArrivals).mockImplementation(async (r) => {
            if (r.provider === 'KMB') throw new Error('offline')
            return { fetchedAt: 100, arrivals: [{ time: 300, remark: '' }] }
        })
        expect((await getJointArrivals(joint, stops['KMB:2'], 2, 'tc', stops)).partial).toBe(true)
        vi.mocked(getArrivals).mockRejectedValue(new Error('offline'))
        await expect(getJointArrivals(joint, stops['KMB:2'], 2, 'en', stops)).rejects.toThrow()
    })
    it('loads missing partner details on demand and reports unmatched stops without wrong requests', async () => {
        vi.mocked(getArrivals).mockResolvedValue({ fetchedAt: 1, arrivals: [] })
        vi.mocked(loadRouteDetails).mockResolvedValue({
            id: ctb.id,
            updatedAt: 1,
            route: ctb,
            stops,
        })
        await getJointArrivals(
            { ...joint, jointPartners: [{ ...ctb, stops: [] }] },
            stops['KMB:2'],
            2,
            'en',
            stops,
        )
        expect(loadRouteDetails).toHaveBeenCalledOnce()
        vi.mocked(getArrivals).mockClear()
        const result = await getJointArrivals(joint, stops['KMB:2'], 2, 'en', {
            ...stops,
            'CTB:2': { ...stops['CTB:2'], lat: 23 },
        })
        expect(result.partial).toBe(true)
        expect(getArrivals).toHaveBeenCalledOnce()
    })
})
