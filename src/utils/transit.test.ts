import { describe, expect, it } from 'vitest'
import type { Bookmark, Route, Stop } from '../types/transit'
import {
    distance,
    hkTime,
    makeSnapshot,
    resolveBookmark,
    routeLetters,
    selectArrivals,
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
