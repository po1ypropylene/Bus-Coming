import { useEffect, useState } from 'react'
import { getJointArrivals } from '../services/joint/arrivals'
import type { ArrivalResult, Lang, Route, Stop } from '../types/transit'
import { upcomingArrivals } from '../utils/arrivals'

export function useArrivals(
    route: Route,
    stop: Stop,
    seq: number,
    lang: Lang,
    stops: Record<string, Stop>,
) {
    const [result, setResult] = useState<ArrivalResult | null>(null)
    const [failed, setFailed] = useState(false)
    const [loading, setLoading] = useState(true)
    const [tick, setTick] = useState(0)
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        let active = true,
            running = false

        async function update() {
            if (document.hidden || running) return
            running = true
            try {
                const next = await getJointArrivals(route, stop, seq, lang, stops)
                if (active) {
                    setResult(next)
                    setNow(Date.now())
                    setFailed(false)
                }
            } catch {
                if (active) setFailed(true)
            } finally {
                running = false
                if (active) setLoading(false)
            }
        }

        void update()
        const timer = setInterval(() => {
            setNow(Date.now())
            void update()
        }, 60000)
        const resume = () => {
            setNow(Date.now())
            void update()
        }
        document.addEventListener('visibilitychange', resume)
        window.addEventListener('online', resume)
        return () => {
            active = false
            clearInterval(timer)
            document.removeEventListener('visibilitychange', resume)
            window.removeEventListener('online', resume)
        }
    }, [route, stop, seq, lang, tick, stops])
    const stale = failed || (!!result && now - result.fetchedAt > 90000)
    const arrivals = upcomingArrivals(result?.arrivals ?? [], now)
    return { result, failed, loading, now, stale, arrivals, refresh: () => setTick((v) => v + 1) }
}
