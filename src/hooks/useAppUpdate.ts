import { useEffect, useRef, useState } from 'react'

export function useAppUpdate() {
    const [status, setStatus] = useState<'idle' | 'checking' | 'current' | 'ready' | 'error'>(
        'idle',
    )
    const registration = useRef<ServiceWorkerRegistration | null>(null)
    const checkRef = useRef<() => Promise<void>>(async () => {})

    useEffect(() => {
        if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
        let disposed = false
        let checking = false
        let lastCheck = 0
        let hadController = !!navigator.serviceWorker.controller
        const cleanups: (() => void)[] = []
        const updateStatus = (next: typeof status) => {
            if (!disposed) setStatus((previous) => (previous === 'ready' ? previous : next))
        }
        const controllerChanged = () => {
            // First installation needs no reload. A changed controller means this page is old.
            if (hadController) updateStatus('ready')
            hadController = true
        }
        navigator.serviceWorker.addEventListener('controllerchange', controllerChanged)
        const registered = navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        const check = async () => {
            if (checking || document.hidden) return
            checking = true
            lastCheck = Date.now()
            updateStatus('checking')
            try {
                if (!navigator.onLine) throw new Error('Offline')
                const reg = await registered
                await reg.update()
                if (reg.waiting) updateStatus('ready')
                else if (!reg.installing) updateStatus('current')
            } catch {
                updateStatus('error')
            } finally {
                checking = false
            }
        }
        checkRef.current = check
        void registered
            .then((reg) => {
                if (disposed) return
                registration.current = reg
                const watch = () => {
                    const worker = reg.installing
                    if (!worker) return
                    const changed = () => {
                        if (worker.state === 'installed')
                            updateStatus(reg.waiting ? 'ready' : 'current')
                        if (worker.state === 'redundant') updateStatus('error')
                    }
                    worker.addEventListener('statechange', changed)
                    cleanups.push(() => worker.removeEventListener('statechange', changed))
                }
                reg.addEventListener('updatefound', watch)
                cleanups.push(() => reg.removeEventListener('updatefound', watch))
                watch()
                if (reg.waiting) updateStatus('ready')
                else void check()
            })
            .catch(() => updateStatus('error'))
        const resume = () => {
            if (!document.hidden && Date.now() - lastCheck > 60000) void check()
        }
        document.addEventListener('visibilitychange', resume)
        window.addEventListener('pageshow', resume)
        window.addEventListener('online', resume)
        const timer = window.setInterval(resume, 60 * 60 * 1000)
        return () => {
            disposed = true
            checkRef.current = async () => {}
            cleanups.forEach((cleanup) => cleanup())
            clearInterval(timer)
            navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged)
            document.removeEventListener('visibilitychange', resume)
            window.removeEventListener('pageshow', resume)
            window.removeEventListener('online', resume)
        }
    }, [])

    function applyUpdate() {
        const waiting = registration.current?.waiting
        if (!waiting) {
            window.location.reload()
            return
        }
        navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => window.location.reload(),
            { once: true },
        )
        waiting.postMessage({ type: 'SKIP_WAITING' })
    }

    return {
        status,
        supported: import.meta.env.PROD && 'serviceWorker' in navigator,
        check: () => checkRef.current(),
        applyUpdate,
    }
}
