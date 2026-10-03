import { expect, it } from 'vitest'
import { oppositeRoute } from './routeDirection'
import { jointRoutes } from '../services/joint/matching'
import fixture from '../services/joint/fixtures/106.json'
import type { Route, Stop } from '../types/transit'

const route = (fixture.routes as Route[])[0]
const reverse: Route = {
    ...route,
    id: 'reverse',
    bound: 'I',
    origin: route.destination,
    destination: route.origin,
}
it('selects only the same operator and service, preserving asymmetric terminals', () => {
    const other: Route = { ...reverse, id: 'other', provider: 'CTB' }
    const special = { ...reverse, id: 'special', service: '2' }
    expect(oppositeRoute(route, [other, special, reverse])).toBe(reverse)
    expect(oppositeRoute(route, [other, special])).toBeNull()
    expect(oppositeRoute(route, [reverse, { ...reverse, id: 'ambiguous' }])).toBeNull()
    expect(
        oppositeRoute(route, [{ ...reverse, origin: { en: 'Different terminal', tc: '另一總站' } }])
            ?.id,
    ).toBe('reverse')
})
it('switches both sides of joint 106 correctly even from a legacy Citybus identity', () => {
    const { byRoute } = jointRoutes(
        fixture.routes as Route[],
        { updatedAt: 1, numbers: ['106'] },
        fixture.stops as Record<string, Stop>,
    )
    for (const current of byRoute.values()) {
        const target = oppositeRoute(current, byRoute.values())!
        expect(target.provider).toBe(current.provider)
        expect(target.bound).not.toBe(current.bound)
        expect(target.jointPartners).toHaveLength(1)
        expect(target.jointPartners![0].bound).not.toBe(target.bound)
        expect(target.jointPartners![0].id).not.toBe(current.jointPartners![0].id)
        expect(oppositeRoute(target, byRoute.values())?.id).toBe(current.id)
    }
})
it('supports NLB route IDs using reversed terminals and rejects circular/ambiguous journeys', () => {
    const nlb: Route = { ...route, provider: 'NLB' }
    const target: Route = { ...reverse, provider: 'NLB', bound: 'O', service: '99' }
    expect(oppositeRoute(nlb, [target])).toBe(target)
    expect(oppositeRoute(nlb, [target, { ...target, id: 'duplicate' }])).toBeNull()
    expect(oppositeRoute({ ...nlb, destination: nlb.origin }, [target])).toBeNull()
    expect(oppositeRoute(route, [])).toBeNull()
})

it('uses a known joint partner when only that operator has a return service', () => {
    const partner: Route = { ...route, id: 'CTB:106:I:1', provider: 'CTB', bound: 'I' }
    const partnerReverse: Route = { ...reverse, id: 'CTB:106:O:1', provider: 'CTB', bound: 'O' }
    expect(oppositeRoute({ ...route, jointPartners: [partner] }, [partnerReverse])).toBe(
        partnerReverse,
    )
    expect(oppositeRoute(route, [partnerReverse])).toBeNull()
})
