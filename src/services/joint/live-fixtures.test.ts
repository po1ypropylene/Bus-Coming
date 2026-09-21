import { expect, it } from 'vitest'
import data102 from './fixtures/102.json'
import data106 from './fixtures/106.json'
import type { Route, Stop } from '../../types/transit'
import { jointRoutes, matchJointStops } from './matching'

for (const [number, data] of [
    ['102', data102],
    ['106', data106],
] as const) {
    it(`matches the audited ${number} journeys without equating operator direction codes`, () => {
        const raw = data.routes as Route[],
            stops = data.stops as Record<string, Stop>
        const { routes } = jointRoutes(raw, { updatedAt: 1, numbers: [number] }, stops)
        expect(routes).toHaveLength(2)
        for (const route of routes) {
            const partner = route.jointPartners![0]
            expect(partner.bound === route.bound).toBe(number === '102')
            const matched = matchJointStops(route, partner, stops)
            expect(matched.length / route.stops.length).toBeGreaterThan(0.8)
        }
    })
}
