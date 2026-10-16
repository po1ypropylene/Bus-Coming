import { useEffect, useState, useSyncExternalStore } from 'react'

// Session-only health of the most recently completed ETA request, never persisted.
let health: { fetchedAt: number; failed: boolean } | null = null
const listeners = new Set<() => void>()

export function reportEtaHealth(fetchedAt: number, failed: boolean) {
    health = { fetchedAt, failed }
    listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}
const snapshot = () => health

export function useEtaHealth() {
    const latest = useSyncExternalStore(subscribe, snapshot)
    const [now, setNow] = useState(Date.now)
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])
    return !latest ? 'waiting' : latest.failed || now - latest.fetchedAt > 90000 ? 'stale' : 'live'
}
