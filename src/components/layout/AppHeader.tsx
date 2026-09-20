import { BusFront, WifiOff } from 'lucide-react'
import { useApp } from '../../app/AppContext'

export function AppHeader() {
    const { navigate, t, tc, online, user, updateUser } = useApp()
    return (
        <header className="app-header">
            <button className="brand" onClick={() => navigate('saved')}>
                <span className="brand-icon">
                    <BusFront size={23} />
                </span>
                <span>
                    {t.brand}
                    <small>{t.subtitle}</small>
                </span>
            </button>
            <div className="header-right">
                <span className="connection">
                    {online ? (
                        <>
                            <i className="live-dot" />
                            {t.live}
                        </>
                    ) : (
                        <>
                            <WifiOff size={14} />
                            {tc ? '離線' : 'Offline'}
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
