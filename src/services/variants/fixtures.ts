import type { Route, Stop } from '../../types/transit'
import type { RouteVariant, VariantCatalog } from './types'

export const variantStops: Record<string, Stop> = Object.fromEntries(
    ['Origin', 'Shared stop', 'Morning stop', 'Normal stop', 'Wing Wo Street', 'Macao Ferry'].map(
        (name, i) => {
            const code = String(i + 1).padStart(6, '0')
            return [
                `CTB:${code}`,
                {
                    id: `CTB:${code}`,
                    code,
                    provider: 'CTB',
                    name: {
                        en: name,
                        tc: ['起點', '共用車站', '早上車站', '正常車站', '永和街', '港澳碼頭'][i],
                    },
                    lat: 22.28 + i * 0.001,
                    lng: 114.15,
                },
            ]
        },
    ),
)
export const variantRoute: Route = {
    id: 'CTB:720:O:1',
    number: '720',
    provider: 'CTB',
    bound: 'O',
    service: '1',
    origin: { en: 'Origin', tc: '起點' },
    destination: { en: 'Central', tc: '中環' },
    stops: Object.keys(variantStops).map((id, i) => ({ id, seq: i + 1 })),
}
export const morningVariant: RouteVariant = {
    id: 'TD:1775:1',
    number: '720',
    name: { en: 'Morning · Wing Wo Street', tc: '早上 · 永和街' },
    stops: ['1', '2', '3', '5'],
    departures: [{ calendar: 'weekday', start: 7 * 3600, end: 9 * 3600, headway: 600 }],
}
export const normalVariant: RouteVariant = {
    id: 'TD:1776:1',
    number: '720',
    name: { en: 'Normal · Macao Ferry', tc: '正常 · 港澳碼頭' },
    stops: ['1', '2', '4', '5', '6'],
    departures: [{ calendar: 'daily', start: 9 * 3600, end: 24 * 3600, headway: 900 }],
}
export function timetableFixture(): VariantCatalog {
    return {
        schema: 1,
        updatedAt: Date.now(),
        variants: [morningVariant, normalVariant],
        stops: Object.fromEntries(
            Object.values(variantStops).map((s, i) => [
                String(i + 1),
                { id: String(i + 1), name: s.name, lat: s.lat, lng: s.lng },
            ]),
        ),
        calendars: {
            weekday: {
                id: 'weekday',
                start: '20200101',
                end: '20991231',
                days: [1, 2, 3, 4, 5],
                exceptions: {},
            },
            daily: {
                id: 'daily',
                start: '20200101',
                end: '20991231',
                days: [0, 1, 2, 3, 4, 5, 6],
                exceptions: {},
            },
        },
    }
}
