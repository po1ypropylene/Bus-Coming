import { useEffect, useRef, useState } from 'react'
import { getJointArrivals } from '../services/joint/arrivals'
import type { ArrivalResult, Lang, Route, Stop } from '../types/transit'
import { upcomingArrivals } from '../utils/arrivals'
import { reportEtaHealth } from './useEtaHealth'
import { useOnline } from './useOnline'

export function useArrivals(
    route: Route,
    stop: Stop,
    seq: number,
    lang: Lang,
    stops: Record<string, Stop>,
) {
    const panelRef = useRef<HTMLDivElement>(null)
    const key = `${route.id}:${stop.id}:${seq}:${lang}`
    const [state, setState] = useState<{
        key: string
        result: ArrivalResult | null
        failed: boolean
        fetching: boolean
    }>({ key, result: null, failed: false, fetching: false })
    const [tick, setTick] = useState(0)
    const [now, setNow] = useState(Date.now)
    const online = useOnline()
    useEffect(() => {
        let active = true,
            running = false,
            visible = false
        const foreground = () => visible && !document.hidden && document.hasFocus()
        async function update() {
            if (!foreground() || !navigator.onLine || running) return
            running = true
            setState((previous) => ({
                key,
                result: previous.key === key ? previous.result : null,
                failed: previous.key === key && previous.failed,
                fetching: true,
            }))
            try {
                const result = await getJointArrivals(route, stop, seq, lang, stops)
                if (active) {
                    setState({ key, result, failed: false, fetching: false })
                    setNow(Date.now())
                    reportEtaHealth(result.fetchedAt, !!result.partial)
                }
            } catch {
                if (active) {
                    setState((previous) => ({ ...previous, failed: true, fetching: false }))
                    reportEtaHealth(Date.now(), true)
                }
            } finally {
                running = false
            }
        }

        const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            if (visible) void update()
        })
        if (panelRef.current) observer.observe(panelRef.current)
        const timer = setInterval(() => {
            void update()
        }, 30000)
        const clock = setInterval(() => {
            if (foreground()) setNow(Date.now())
        }, 1000)
        const resume = () => {
            setNow(Date.now())
            void update()
        }
        document.addEventListener('visibilitychange', resume)
        window.addEventListener('focus', resume)
        window.addEventListener('online', resume)
        return () => {
            active = false
            observer.disconnect()
            clearInterval(timer)
            clearInterval(clock)
            document.removeEventListener('visibilitychange', resume)
            window.removeEventListener('focus', resume)
            window.removeEventListener('online', resume)
        }
    }, [route, stop, seq, lang, tick, stops, key])
    const result = state.key === key ? state.result : null
    const failed = state.key === key && state.failed
    const fetching = state.key === key && state.fetching
    const loading = !result && !failed && online
    const stale =
        !online || failed || !!result?.partial || (!!result && now - result.fetchedAt > 90000)
    const arrivals = upcomingArrivals(result?.arrivals ?? [])
    return {
        panelRef,
        result,
        failed,
        loading,
        fetching,
        online,
        now,
        stale,
        arrivals,
        refresh: () => setTick((v) => v + 1),
    }
}
