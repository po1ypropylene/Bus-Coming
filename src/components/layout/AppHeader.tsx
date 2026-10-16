import { useEtaHealth } from '../../hooks/useEtaHealth'
import { BusFront, WifiOff } from 'lucide-react'
import { useApp } from '../../app/AppContext'

export function AppHeader() {
    const { navigate, t, tc, online, user, updateUser } = useApp()
    const health = useEtaHealth()
    return (
        <header className="app-header">
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
                            <i className={`live-dot ${health}`}/>
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
    )
}
