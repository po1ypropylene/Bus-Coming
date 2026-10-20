import { expect, it } from 'vitest'
import { routeVariantOptions } from './matching'
import {
    morningVariant,
    normalVariant,
    timetableFixture,
    variantRoute,
    variantStops,
} from './fixtures'

it('keeps the operator itinerary when no catalogue or only one pattern exists', () => {
    const catalog = timetableFixture()
    expect(routeVariantOptions(variantRoute, [variantRoute], variantStops, null)).toEqual([])
    catalog.variants = [morningVariant]
    expect(routeVariantOptions(variantRoute, [variantRoute], variantStops, catalog)).toEqual([])
    catalog.variants = []
    expect(routeVariantOptions(variantRoute, [variantRoute], variantStops, catalog)).toEqual([])
})
it('does not mistake duplicate TD records for different routing variants', () => {
    const catalog = timetableFixture()
    catalog.variants = [
        morningVariant,
        { ...morningVariant, id: 'TD:9999:1', departures: normalVariant.departures },
    ]
    expect(routeVariantOptions(variantRoute, [variantRoute], variantStops, catalog)).toEqual([])
    catalog.variants.push(normalVariant)
    const options = routeVariantOptions(variantRoute, [variantRoute], variantStops, catalog)
    expect(options).toHaveLength(2)
    expect(
        options.find((v) => v.variant.id === morningVariant.id)?.variant.departures,
    ).toHaveLength(2)
    expect(morningVariant.departures).toHaveLength(1)
})
it('preserves joint itineraries through both membership and paired operator evidence', () => {
    const catalog = timetableFixture()
    const joint = {
        ...variantRoute,
        jointPartners: [{ ...variantRoute, id: 'KMB:720:O:1', provider: 'KMB' as const }],
    }
    expect(routeVariantOptions(joint, [joint], variantStops, catalog)).toEqual([])
    expect(
        routeVariantOptions(variantRoute, [variantRoute], variantStops, catalog, ['720']),
    ).toEqual([])
    expect(
        routeVariantOptions(variantRoute, [variantRoute], variantStops, catalog, ['102']),
    ).toHaveLength(2)
})
