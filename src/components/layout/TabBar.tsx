import { useEffect, useRef, useState } from 'react'
import { Bookmark as BookmarkIcon, Navigation, Search, Settings2 } from 'lucide-react'
import { useApp } from '../../app/AppContext'
import { SelectionLens } from '../glass/SelectionLens'

const tabs = [
    { key: 'saved', icon: BookmarkIcon },
    { key: 'nearby', icon: Navigation },
    { key: 'search', icon: Search },
    { key: 'settings', icon: Settings2 },
] as const

export function TabBar() {
    const { tab, tc, t, navigate } = useApp()
    const host = useRef<HTMLElement>(null)
    const [dragIndex, setDragIndex] = useState<number | null>(null)
    const [minimized, setMinimized] = useState(false)
    const drag = useRef({ start: 0, moved: false })
    useEffect(() => {
        let previous = window.scrollY
        const scroll = () => {
            const current = window.scrollY
            if (Math.abs(current - previous) > 24) {
                setMinimized(current > previous && current > 80)
                previous = current
            }
        }
        window.addEventListener('scroll', scroll, { passive: true })
        return () => window.removeEventListener('scroll', scroll)
    }, [])
    const indexAt = (x: number) => {
        const rect = host.current!.getBoundingClientRect()
        return Math.max(0, Math.min(3, (x - rect.left - 4) / ((rect.width - 8) / 4) - 0.5))
    }
    return (
        <nav
            ref={host}
            className={`tab-bar ${minimized ? 'is-minimized' : ''}`}
            aria-label={tc ? '主導覽' : 'Main navigation'}
            onPointerDown={(event) => {
                if (event.button !== 0) return
                setMinimized(false)
                drag.current = { start: event.clientX, moved: false }
                setDragIndex(indexAt(event.clientX))
            }}
            onPointerMove={(event) => {
                if (dragIndex === null) return
                if (Math.abs(event.clientX - drag.current.start) > 8) {
                    drag.current.moved = true
                    event.currentTarget.setPointerCapture(event.pointerId)
                }
                setDragIndex(indexAt(event.clientX))
            }}
            onPointerUp={(event) => {
                if (dragIndex === null) return
                if (drag.current.moved) navigate(tabs[Math.round(indexAt(event.clientX))].key)
                setDragIndex(null)
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={() => setDragIndex(null)}
            onClickCapture={(event) => {
                if (drag.current.moved) {
                    event.preventDefault()
                    event.stopPropagation()
                    drag.current.moved = false
                }
            }}
        >
            <div className="tab-bar-surface glass" aria-hidden="true" />
            {tabs.map(({ key, icon: Icon }) => (
                <button
                    key={key}
                    className={tab === key ? 'tab active' : 'tab'}
                    aria-label={t[key]}
                    aria-current={tab === key ? 'page' : undefined}
                    onClick={() => navigate(key)}
                >
                    <Icon size={23} strokeWidth={tab === key ? 2.3 : 1.7} />
                    <span>{t[key]}</span>
                </button>
            ))}
            <SelectionLens
                host={host}
                index={dragIndex ?? tabs.findIndex((item) => item.key === tab)}
                count={4}
                pressed={dragIndex !== null}
            >
                {tabs.map(({ key, icon: Icon }) => (
                    <span key={key} className="tab">
                        <Icon size={23} strokeWidth={2.3} />
                        <span>{t[key]}</span>
                    </span>
                ))}
            </SelectionLens>
        </nav>
    )
}
