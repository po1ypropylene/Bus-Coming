import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/** The expanded heading owns layout; this compact sibling appears only once it has passed. */
export function RouteStickyHeader({ children, title }: { children: ReactNode; title: string }) {
    const marker = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0)
        })
        if (marker.current) observer.observe(marker.current)
        return () => observer.disconnect()
    }, [])
    return (
        <>
            <div ref={marker} className="route-header-marker" aria-hidden="true" />
            <div className={`route-compact-header ${visible ? 'is-visible' : ''}`}>
                <div className="route-compact-surface glass" aria-hidden="true" />
                <strong>{title}</strong>
                {children}
            </div>
        </>
    )
}
