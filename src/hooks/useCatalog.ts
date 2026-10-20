import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../storage/catalogDb'
import { cachedVariantCatalog, VARIANT_CACHE_KEY } from '../services/variants/catalog'
import type { VariantCatalog } from '../services/variants/types'
import { cachedJointCatalog, JOINT_CACHE_KEY } from '../services/joint/catalog'
import type { CatalogEvent, JointCatalog, Progress, RouteCatalog, Snapshot } from '../types/transit'

export function useCatalog() {
    const [variantCatalog, setVariantCatalog] = useState<VariantCatalog | null>(null)
    const [variantError, setVariantError] = useState(false)
    const [jointCatalog, setJointCatalog] = useState<JointCatalog | null>(null)
    const [jointError, setJointError] = useState(false)
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
            if (data.type === 'variants') {
                setVariantCatalog(data.catalog)
                setVariantError(false)
            }
            if (data.type === 'variantsError') setVariantError(true)
            if (data.type === 'joint') {
                setJointCatalog(data.catalog)
                setJointError(false)
            }
            if (data.type === 'jointError') setJointError(true)
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
                        database.get('responses', JOINT_CACHE_KEY),
                        database.get('responses', VARIANT_CACHE_KEY),
                    ])
                } finally {
                    database.close()
                }
            })
            .then(([saved, catalogs, joint, variants]) => {
                if (active) {
                    setVariantCatalog(cachedVariantCatalog(variants?.data))
                    setJointCatalog(cachedJointCatalog(joint?.data))
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
    return {
        variantCatalog,
        variantError,
        jointCatalog,
        jointError,
        snapshots,
        catalogs,
        progress,
        busy,
        storageError,
        refresh,
    }
}
