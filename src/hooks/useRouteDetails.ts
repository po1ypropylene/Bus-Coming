import { useEffect, useState } from 'react'
import { loadRouteDetails } from '../services/catalog/routeDetails'
import type { Route, RouteDetails, Stop } from '../types/transit'

export function useRouteDetails(route: Route, downloadedStops: Record<string, Stop>) {
    const [result, setResult] = useState<{
        id: string
        data?: RouteDetails
        error?: boolean
    } | null>(null)
    const [attempt, setAttempt] = useState(0)
    const complete = route.stops.length > 0 && route.stops.every((s) => downloadedStops[s.id])
    useEffect(() => {
        if (complete) return
        let active = true
        void loadRouteDetails(route)
            .then((data) => {
                if (active) setResult({ id: route.id, data })
            })
            .catch(() => {
                if (active) setResult({ id: route.id, error: true })
            })
        return () => {
            active = false
        }
    }, [route, complete, attempt])
    const current = result?.id === route.id ? result : null
    return {
        route: complete ? route : (current?.data?.route ?? route),
        stops: complete ? downloadedStops : (current?.data?.stops ?? {}),
        loading: !complete && !current,
        error: !complete && !!current?.error,
        retry: () => {
            setResult(null)
            setAttempt((a) => a + 1)
        },
    }
}
