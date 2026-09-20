import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../storage/catalogDb'
import type { CatalogEvent, Progress, RouteCatalog, Snapshot } from '../types/transit'

export function useCatalog() {
    const [catalogs, setCatalogs] = useState<RouteCatalog[]>([])
    const [snapshots, setSnapshots] = useState<Snapshot[]>([])
    const [progress, setProgress] = useState<Progress[]>([])
    const [busy, setBusy] = useState(false)
    const [storageError, setStorageError] = useState(false)
    const worker = useRef<Worker | null>(null)
    const refresh = useCallback((force = true) => {
        if (worker.current) {
            setBusy(true)
            worker.current.postMessage({ force })
        }
    }, [])
    useEffect(() => {
        let active = true
        const instance = new Worker(new URL('../workers/catalog.worker.ts', import.meta.url), {
            type: 'module',
        })
        worker.current = instance
        instance.onmessage = (event) => {
            const data = event.data as CatalogEvent
            if (data.type === 'catalog')
                setCatalogs((old) => [
                    ...old.filter((c) => c.provider !== data.catalog.provider),
                    data.catalog,
                ])
            if (data.type === 'snapshot')
                setSnapshots((old) => [
                    ...old.filter((s) => s.provider !== data.snapshot.provider),
                    data.snapshot,
                ])
            if (data.type === 'progress')
                setProgress((old) => [
                    ...old.filter((p) => p.provider !== data.progress.provider),
                    data.progress,
                ])
            if (data.type === 'complete') setBusy(false)
        }
        instance.onerror = () => {
            setBusy(false)
            setStorageError(true)
        }
        void db()
            .then(async (database) => {
                try {
                    return await Promise.all([
                        database.getAll('snapshots'),
                        database.getAll('routeCatalogs'),
                    ])
                } finally {
                    database.close()
                }
            })
            .then(([saved, catalogs]) => {
                if (active) {
                    setSnapshots(saved)
                    setCatalogs(catalogs)
                    refresh(false)
                }
            })
            .catch(() => {
                if (active) setStorageError(true)
            })
        const resume = () => {
            if (document.visibilityState === 'visible' && navigator.onLine) refresh(false)
        }
        const timer = setInterval(resume, 60 * 60 * 1000)
        document.addEventListener('visibilitychange', resume)
        window.addEventListener('online', resume)
        return () => {
            active = false
            instance.terminate()
            worker.current = null
            clearInterval(timer)
            document.removeEventListener('visibilitychange', resume)
            window.removeEventListener('online', resume)
        }
    }, [refresh])
    return { snapshots, catalogs, progress, busy, storageError, refresh }
}
