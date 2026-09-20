import { useEffect, useState } from 'react'
import { getArrivals } from '../services/api'
import type { ArrivalResult, Route, Stop, Lang } from '../types/transit'
export function useArrivals(route: Route, stop: Stop, seq: number, lang: Lang) {
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
        const next = await getArrivals(route, stop, seq, lang)
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
  }, [route, stop, seq, lang, tick])
  const stale = failed || (!!result && now - result.fetchedAt > 90000)
  const arrivals =
    result?.arrivals.filter((a) => a.time === null || a.time > now - 60000).slice(0, 3) ?? []
  return { result, failed, loading, now, stale, arrivals, refresh: () => setTick((v) => v + 1) }
}
