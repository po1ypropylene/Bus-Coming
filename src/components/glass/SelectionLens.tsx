import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { FrameBudget, makeLensMap, nextFilterId, springStep } from '../../utils/glass'

const SVG = 'http://www.w3.org/2000/svg'

/** Only the small highlighted label copy is filtered; the page is never cloned. */
export function SelectionLens({
    host,
    index,
    count,
    pressed = false,
    children,
}: {
    host: RefObject<HTMLElement | null>
    index: number
    count: number
    pressed?: boolean
    children: ReactNode
}) {
    const lens = useRef<HTMLDivElement>(null)
    const copy = useRef<HTMLDivElement>(null)
    const defs = useRef<SVGDefsElement>(null)
    const graphic = useRef<HTMLDivElement>(null)
    const motion = useRef({ position: 0, velocity: 0, initialized: false })
    const budget = useRef(new FrameBudget())

    useLayoutEffect(() => {
        const track = host.current,
            element = lens.current,
            labels = copy.current
        const definitions = defs.current,
            targetGraphic = graphic.current
        if (!track || !element || !labels || !definitions || !targetGraphic) return
        let frame = 0,
            cleanupFrame = 0,
            last = 0
        let target = 0
        const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
        const root = document.documentElement
        try {
            if (sessionStorage.getItem('bus-coming-lens-degraded') === 'true')
                root.dataset.lensDegraded = 'true'
        } catch {
            /* Session-only fallback remains active on the root. */
        }
        const paint = () => {
            element.style.transform = `translateX(${motion.current.position}px)`
            labels.style.left = `${-motion.current.position}px`
        }
        const tick = (now: number) => {
            const elapsed = last ? now - last : 1000 / 60
            last = now
            const state = motion.current
            const next = springStep(state.position, state.velocity, target, elapsed / 1000)
            Object.assign(state, next)
            paint()
            if (
                root.dataset.glassEffective !== 'reduced' &&
                root.dataset.refraction !== 'false' &&
                budget.current.add(elapsed)
            ) {
                root.dataset.lensDegraded = 'true'
                try {
                    sessionStorage.setItem('bus-coming-lens-degraded', 'true')
                } catch {
                    /* Keep in memory. */
                }
            }
            if (Math.abs(target - state.position) > 0.1 || Math.abs(state.velocity) > 0.1)
                frame = requestAnimationFrame(tick)
            else {
                state.position = target
                state.velocity = 0
                paint()
            }
        }
        const measure = () => {
            cancelAnimationFrame(frame)
            cancelAnimationFrame(cleanupFrame)
            // Retire any earlier generation only after the new URL has been painted.
            const old = [...definitions.children]
            const width = (track.clientWidth - 8) / count
            const height = track.clientHeight - 8
            if (width <= 0 || height <= 0) return
            target = width * index
            element.style.width = `${width}px`
            labels.style.width = `${track.clientWidth - 8}px`
            const filter = document.createElementNS(SVG, 'filter')
            const id = nextFilterId()
            const w = Math.round(width),
                h = Math.round(height)
            for (const [name, value] of Object.entries({
                id,
                filterUnits: 'userSpaceOnUse',
                x: '0',
                y: '0',
                width: String(w),
                height: String(h),
                'color-interpolation-filters': 'sRGB',
            }))
                filter.setAttribute(name, value)
            const image = document.createElementNS(SVG, 'feImage')
            for (const [name, value] of Object.entries({
                href: makeLensMap(w, h),
                x: '0',
                y: '0',
                width: String(w),
                height: String(h),
                preserveAspectRatio: 'none',
                result: 'map',
            }))
                image.setAttribute(name, value)
            const displacement = document.createElementNS(SVG, 'feDisplacementMap')
            for (const [name, value] of Object.entries({
                in: 'SourceGraphic',
                in2: 'map',
                scale: pressed ? '22.4' : '14',
                xChannelSelector: 'R',
                yChannelSelector: 'G',
            }))
                displacement.setAttribute(name, value)
            filter.append(image, displacement)
            definitions.append(filter)
            targetGraphic.style.filter = `url(#${id})`
            cleanupFrame = requestAnimationFrame(() => old.forEach((node) => node.remove()))
            if (!motion.current.initialized || reducedMotion.matches) {
                motion.current.position = target
                motion.current.velocity = 0
                motion.current.initialized = true
                paint()
            } else {
                last = 0
                frame = requestAnimationFrame(tick)
            }
        }
        const observer = new ResizeObserver(measure)
        observer.observe(track)
        reducedMotion.addEventListener('change', measure)
        measure()
        return () => {
            observer.disconnect()
            reducedMotion.removeEventListener('change', measure)
            cancelAnimationFrame(frame)
            cancelAnimationFrame(cleanupFrame)
        }
    }, [host, index, count, pressed])

    return (
        <>
            <svg width="0" height="0" className="lens-definitions" aria-hidden="true">
                <defs ref={defs} />
            </svg>
            <div
                className={`selection-lens ${pressed ? 'is-pressed' : ''}`}
                ref={lens}
                aria-hidden="true"
            >
                <div className="selection-lens-surface" />
                <div className="selection-lens-clip">
                    <div className="selection-lens-refract" ref={graphic}>
                        <div className="selection-lens-copy" inert ref={copy}>
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
