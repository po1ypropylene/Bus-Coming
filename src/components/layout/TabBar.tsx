import { Bookmark as BookmarkIcon, Navigation, Search, Settings2 } from 'lucide-react'
import { useApp } from '../../app/AppContext'

export function TabBar() {
    const { tab, tc, t, navigate } = useApp()
    return (
        <nav className="tab-bar" aria-label={tc ? '主導覽' : 'Main navigation'}>
            {(
                [
                    { key: 'saved', icon: BookmarkIcon },
                    { key: 'nearby', icon: Navigation },
                    { key: 'search', icon: Search },
                    { key: 'settings', icon: Settings2 },
                ] as const
            ).map(({ key, icon: Icon }) => (
                <button
                    key={key}
                    className={tab === key ? 'tab active' : 'tab'}
                    aria-current={tab === key ? 'page' : undefined}
                    onClick={() => navigate(key)}
                >
                    <Icon size={23} strokeWidth={tab === key ? 2.3 : 1.7} />
                    <span>{t[key]}</span>
                </button>
            ))}
        </nav>
    )
}
