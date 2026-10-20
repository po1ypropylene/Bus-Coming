import { expect, it } from 'vitest'
import captured from './fixtures/720.json'
import twoX from './fixtures/2x.json'
import route102 from './fixtures/102.json'
import joint102 from '../joint/fixtures/102.json'
import { jointRoutes } from '../joint/matching'
import { cachedVariantCatalog } from './catalog'
import { matchesDirection, variantEntries, routeVariantOptions } from './matching'
import { defaultVariant } from './schedule'
import type { Route, Stop } from '../../types/transit'
import type { VariantCatalog } from './types'

it('selects real 720 morning, normal and evening patterns without equating TD and Citybus bounds', () => {
    const catalog = captured.catalog as VariantCatalog
    const routes = captured.operator.routes as Route[]
    const stops = captured.operator.stops as Record<string, Stop>
    expect(cachedVariantCatalog(catalog)).toBe(catalog)
    const options = (route: Route) =>
        catalog.variants.filter((v) =>
            matchesDirection(variantEntries(v, catalog, routes, stops), route),
        )
    const outbound = options(routes.find((r) => r.bound === 'O')!)
    const inbound = options(routes.find((r) => r.bound === 'I')!)
    expect(outbound).toHaveLength(3)
    expect(inbound).toHaveLength(3)
    for (const [list, hour, prefix] of [
        [outbound, '07:55', 'TD:1775:'],
        [outbound, '08:50', 'TD:1000281:'],
        [outbound, '09:05', 'TD:1776:'],
        [inbound, '19:00', 'TD:8142:'],
    ] as const) {
        expect(defaultVariant(list, catalog, Date.parse(`2026-10-20T${hour}:00+08:00`))).toMatch(
            new RegExp(`^${prefix}`),
        )
    }
    const morning = outbound.find((v) => v.id.startsWith('TD:1000281:'))!
    const normal = outbound.find((v) => v.id.startsWith('TD:1776:'))!
    expect(morning.stops.some((s) => catalog.stops[s].name.en.includes('CITYPLAZA'))).toBe(false)
    expect(normal.stops.some((s) => catalog.stops[s].name.en.includes('CITYPLAZA'))).toBe(true)
    const circular = outbound.find((v) => v.id.startsWith('TD:1775:'))!
    const uncertain = variantEntries(circular, catalog, routes, stops).filter((e) => !e.api)
    expect(uncertain.map((e) => e.stop.name.en)).toEqual(['WING WO STREET, CONNAUGHT ROAD CENTRAL'])
})

it('leaves real 2X directions on their original operator itinerary', () => {
    const catalog = twoX.catalog as VariantCatalog
    const routes = twoX.operator.routes as Route[]
    const stops = twoX.operator.stops as Record<string, Stop>
    for (const route of routes) {
        expect(
            catalog.variants.filter((v) =>
                matchesDirection(variantEntries(v, catalog, routes, stops), route),
            ),
        ).toHaveLength(1)
        expect(routeVariantOptions(route, routes, stops, catalog)).toEqual([])
    }
})
it('keeps real 102 combined itineraries even where TD publishes a short-working variant', () => {
    const catalog = route102.catalog as VariantCatalog
    const { routes, stops } = joint102 as { routes: Route[]; stops: Record<string, Stop> }
    const combined = jointRoutes(routes, { updatedAt: Date.now(), numbers: ['102'] }, stops)
    for (const route of combined.byRoute.values()) {
        expect(routeVariantOptions(route, routes, stops, catalog, ['102'])).toEqual([])
    }
    const inbound = routes.find((r) => r.provider === 'CTB' && r.bound === 'I')!
    expect(
        catalog.variants.filter((v) =>
            matchesDirection(variantEntries(v, catalog, routes, stops), inbound),
        ),
    ).toHaveLength(2)
})
