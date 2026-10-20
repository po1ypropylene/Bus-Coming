import { useEffect, useRef, useState } from 'react'
import { useEtaHealth } from '../../hooks/useEtaHealth'
import { BusFront, WifiOff } from 'lucide-react'
import { useApp } from '../../app/AppContext'

export function AppHeader() {
    const { navigate, t, tc, online, user, updateUser } = useApp()
    const health = useEtaHealth()
    const sentinel = useRef<HTMLDivElement>(null)
    const [scrolled, setScrolled] = useState(false)
    useEffect(() => {
        const header = sentinel.current?.nextElementSibling
        const size = new ResizeObserver(() => {
            if (header)
                document.documentElement.style.setProperty(
                    '--header-height',
                    `${header.getBoundingClientRect().height}px`,
                )
        })
        if (header) size.observe(header)
        const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting))
        if (sentinel.current) observer.observe(sentinel.current)
        return () => {
            observer.disconnect()
            size.disconnect()
        }
    }, [])
    return (
        <>
            <div className="header-sentinel" ref={sentinel} aria-hidden="true" />
            <header className={`app-header ${scrolled ? 'is-scrolled' : ''}`}>
                <button aria-label={t.brand} className="brand" onClick={() => navigate('saved')}>
                    <span className="brand-icon">
                        <BusFront size={23} />
                    </span>
                    <span>
                        {t.brand}
                        <small>{t.subtitle}</small>
                    </span>
                </button>
                <div className="header-right">
                    <span className={`connection ${online ? health : 'offline'}`}>
                        {online ? (
                            <>
                                <i className={`live-dot ${health}`} />
                                {health === 'live'
                                    ? t.live
                                    : health === 'stale'
                                      ? t.etaStale
                                      : t.etaWaiting}
                            </>
                        ) : (
                            <>
                                <WifiOff size={14} />
                                {t.offlineLabel}
                            </>
                        )}
                    </span>
                    <button
                        className="language-toggle"
                        aria-label={t.language}
                        onClick={() => updateUser({ ...user, language: tc ? 'en' : 'tc' })}
                    >
                        {tc ? 'EN' : '繁'}
                    </button>
                </div>
            </header>
        </>
    )
}
