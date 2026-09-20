import { describe, expect, it } from 'vitest'
import type { Bookmark, Route, Stop } from '../types/transit'
import {
    distance,
    hkTime,
    makeSnapshot,
    resolveBookmark,
    routeLetters,
    selectArrivals,
    selectCitybusArrivals,
    validateUserData,
} from '../utils/transit'

const stop: Stop = {
    id: 'KMB:ABC',
    code: 'ABC',
    provider: 'KMB',
    name: { en: 'Stop', tc: '車站' },
    lat: 22.3,
    lng: 114.2,
}
const route: Route = {
    id: 'KMB:1:O:1',
    number: '1',
    provider: 'KMB',
    bound: 'O',
    service: '1',
    origin: { en: 'A', tc: '甲' },
    destination: { en: 'B', tc: '乙' },
    stops: [
        { id: stop.id, seq: 2 },
        { id: stop.id, seq: 1 },
    ],
}
const bookmark: Bookmark = {
    id: 'bookmark',
    routeId: route.id,
    stopId: stop.id,
    seq: 1,
    group: 'Home',
    route,
    stop,
}
describe('operator correctness', () => {
    it('does not mix directions, special services, or repeated stop sequences', () => {
        const row = {
            dir: 'O',
            seq: 1,
            service_type: 1,
            eta: '2026-09-20T12:00:00+08:00',
            rmk_en: 'Scheduled',
            rmk_tc: '預定班次',
        }
        expect(
            selectArrivals(
                [row, { ...row, dir: 'I' }, { ...row, seq: 2 }, { ...row, service_type: 2 }],
                route,
                1,
                'tc',
            ),
        ).toEqual([{ time: Date.parse(row.eta), remark: '預定班次' }])
    })
    it('preserves operator remarks when ETA is absent', () =>
        expect(
            selectArrivals(
                [{ dir: 'O', seq: 1, eta: null, rmk_en: 'Last bus departed' }],
                route,
                1,
                'en',
            ),
        ).toEqual([{ time: null, remark: 'Last bus departed' }]))
    it('interprets NLB timestamps in Hong Kong even when client is abroad', () => {
        expect(hkTime('2026-09-20 12:30:00')).toBe(Date.parse('2026-09-20T04:30:00Z'))
        expect(hkTime('not-a-date')).toBeNull()
    })
    it('sorts numeric sequences and indexes every visit to a stop', () => {
        const snapshot = makeSnapshot('KMB', [structuredClone(route)], { [stop.id]: stop })
        expect(snapshot.routes[0].stops.map((s) => s.seq)).toEqual([1, 2])
        expect(snapshot.stopRoutes[stop.id]).toHaveLength(2)
    })
    it('rejects snapshots with dangling stop references', () =>
        expect(() => makeSnapshot('KMB', [route], {})).toThrow('Missing stop'))
    it('derives actual keypad letters from prefixes and suffixes', () =>
        expect(
            routeLetters(
                ['A21', '1X', 'NA10', 'B6', 'E11'].map((number) => ({ ...route, number })),
            ),
        ).toEqual(['A', 'B', 'E', 'N', 'X']))
    it('computes nearby distance in meters', () => {
        expect(distance(stop, stop)).toBe(0)
        expect(distance(stop, { lat: 22.301, lng: 114.2 })).toBeCloseTo(111.195, 2)
    })
})
describe('user data protection', () => {
    it('accepts a valid backup', () =>
        expect(
            validateUserData({ version: 1, language: 'tc', bookmarks: [bookmark] }).bookmarks,
        ).toHaveLength(1))
    it.each([
        { version: 5, language: 'en', bookmarks: [] },
        { version: 1, language: 'en', bookmarks: [{}] },
        { version: 1, language: 'en', bookmarks: [{ ...bookmark, stopId: 'wrong' }] },
        { version: 1, language: 'en', bookmarks: [bookmark, bookmark] },
    ])('rejects malformed or incompatible backups', (data) =>
        expect(() => validateUserData(data)).toThrow(),
    )
    it('marks removed route visits unavailable after a refresh', () => {
        const snapshot = makeSnapshot('KMB', [{ ...route, stops: [{ id: stop.id, seq: 2 }] }], {
            [stop.id]: stop,
        })
        expect(resolveBookmark(bookmark, [snapshot]).available).toBe(false)
        expect(resolveBookmark(bookmark, []).available).toBe(true)
    })
})

describe('theme preference migration', () => {
    it('defaults older backups to green without changing bookmarks or language', () => {
        const data = validateUserData({ version: 1, language: 'tc', bookmarks: [bookmark] })
        expect(data.theme).toBe('green')
        expect(data.language).toBe('tc')
        expect(data.bookmarks).toEqual([bookmark])
    })
    it.each(['green', 'blue', 'yellow', 'red', 'purple'])('preserves %s in backups', (theme) => {
        expect(validateUserData({ version: 1, language: 'en', theme, bookmarks: [] }).theme).toBe(
            theme,
        )
    })
    it.each(['unknown', null, {}, 3])('rejects an invalid theme: %s', (theme) => {
        expect(() =>
            validateUserData({ version: 1, language: 'en', theme, bookmarks: [] }),
        ).toThrow()
    })
})

describe('Citybus direction-specific sequence mismatches', () => {
    const inbound: Route = {
        ...route,
        id: 'CTB:N8P:I:1',
        provider: 'CTB',
        number: 'N8P',
        bound: 'I',
        stops: [
            { id: 'CTB:002424', seq: 1 },
            { id: 'CTB:001223', seq: 12 },
        ],
    }
    const row = {
        co: 'CTB',
        route: 'N8P',
        dir: 'I',
        stop: '002424',
        seq: 12,
        eta: '2026-09-21T03:35:42+08:00',
        rmk_en: 'Scheduled',
        rmk_tc: '預定班次',
    }
    it('accepts N8P inbound ETA sequence 12 for unique catalogue stop 1', () => {
        expect(selectCitybusArrivals([row], inbound, '002424', 1, 'tc')).toEqual([
            { time: Date.parse(row.eta), remark: '預定班次' },
        ])
        expect(
            selectCitybusArrivals(
                [{ ...row, stop: '001223', seq: 23 }],
                inbound,
                '001223',
                12,
                'en',
            ),
        ).toHaveLength(1)
    })
    it('does not mix direction, route, stop or company even with matching sequence', () => {
        const wrong = [
            { ...row, dir: 'O' },
            { ...row, route: '8P' },
            { ...row, stop: '001223' },
            { ...row, co: 'KMB' },
        ]
        expect(selectCitybusArrivals(wrong, inbound, '002424', 1, 'en')).toEqual([])
    })
    it('retains strict sequence matching for repeated visits and incomplete stop lists', () => {
        const repeated = { ...inbound, stops: [...inbound.stops, { id: 'CTB:002424', seq: 12 }] }
        expect(selectCitybusArrivals([row], repeated, '002424', 1, 'en')).toEqual([])
        expect(selectCitybusArrivals([row], repeated, '002424', 12, 'en')).toHaveLength(1)
        expect(selectCitybusArrivals([row], { ...inbound, stops: [] }, '002424', 1, 'en')).toEqual(
            [],
        )
    })
    it('preserves normal outbound sequences and null-ETA remarks', () => {
        const outbound = { ...inbound, bound: 'O' as const }
        expect(
            selectCitybusArrivals(
                [{ ...row, dir: 'O', seq: 1, eta: null }],
                outbound,
                '002424',
                1,
                'en',
            ),
        ).toEqual([{ time: null, remark: 'Scheduled' }])
    })
})
