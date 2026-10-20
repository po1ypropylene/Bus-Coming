import { expect, it } from 'vitest'
import captured from './fixtures/720.json'
import { cachedVariantCatalog } from './catalog'
import { matchesDirection, variantEntries } from './matching'
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
