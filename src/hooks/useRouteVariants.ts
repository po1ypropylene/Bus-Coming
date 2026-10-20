import { useEffect, useMemo, useState } from 'react'
import { defaultVariant, nextDeparture } from '../services/variants/schedule'
import { routeVariantOptions } from '../services/variants/matching'
import type { VariantCatalog } from '../services/variants/types'
import type { Route, Stop } from '../types/transit'

export function useRouteVariants(
    route: Route,
    family: Route[],
    stops: Record<string, Stop>,
    catalog: VariantCatalog | null,
    selectedStop: string | null,
    jointNumbers?: readonly string[],
) {
    const [manual, setManual] = useState<string | null>(null)
    const [anchor] = useState(() => selectedStop?.split(':').slice(0, 2).join(':'))
    const [now, setNow] = useState(Date.now)
    useEffect(() => {
        const update = () => setNow(Date.now())
        const timer = setInterval(update, 30000)
        document.addEventListener('visibilitychange', update)
        return () => {
            clearInterval(timer)
            document.removeEventListener('visibilitychange', update)
        }
    }, [])
    const options = useMemo(
        () => routeVariantOptions(route, family, stops, catalog, jointNumbers),
        [route, family, stops, catalog, jointNumbers],
    )
    const eligible = options.filter(
        ({ entries }) => !anchor || entries.some((e) => e.api?.stop.id === anchor),
    )
    const automatic = catalog
        ? defaultVariant(
              eligible.map((v) => v.variant),
              catalog,
              now,
          )
        : null
    const manualChoice =
        manual && manual !== 'operator' && !options.some((v) => v.variant.id === manual)
            ? 'operator'
            : manual
    const selected = options.find((v) => v.variant.id === (manualChoice ?? automatic))
    return {
        options,
        selected,
        manual: manualChoice,
        setManual,
        now,
        next: selected && catalog ? nextDeparture(selected.variant, catalog, now) : null,
    }
}
