export interface GlassPreferences {
    intensity: number
    mode: 'auto' | 'full' | 'reduced'
    refraction: boolean
}

export const DEFAULT_GLASS: GlassPreferences = {
    intensity: 0.45,
    mode: 'auto',
    refraction: true,
}

export function validGlass(value: unknown): value is GlassPreferences {
    if (!value || typeof value !== 'object') return false
    const data = value as GlassPreferences
    return (
        Number.isFinite(data.intensity) &&
        data.intensity >= 0 &&
        data.intensity <= 1 &&
        ['auto', 'full', 'reduced'].includes(data.mode) &&
        typeof data.refraction === 'boolean'
    )
}

export function springStep(position: number, velocity: number, target: number, seconds: number) {
    const dt = Math.max(0, Math.min(seconds, 1 / 30))
    const nextVelocity = velocity + ((target - position) * 260 - velocity * 22) * dt
    return { position: position + nextVelocity * dt, velocity: nextVelocity }
}

export class FrameBudget {
    elapsed = 0
    frames = 0
    add(milliseconds: number) {
        this.elapsed += milliseconds
        this.frames++
        if (this.elapsed < 2000) return false
        const slow = this.elapsed / this.frames > 24
        this.elapsed = 0
        this.frames = 0
        return slow
    }
}

let filterSequence = 0
export function nextFilterId() {
    return `glass-lens-${++filterSequence}`
}

const maps = new Map<string, string>()
export function makeLensMap(width: number, height: number) {
    const w = Math.max(1, Math.round(width)),
        h = Math.max(1, Math.round(height))
    const key = `${w}:${h}`
    if (maps.has(key)) return maps.get(key)!
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    const image = ctx.createImageData(w, h)
    const radius = h / 2
    const sd = (x: number, y: number) => {
        const qx = Math.abs(x + 0.5 - w / 2) - (w / 2 - radius)
        const qy = Math.abs(y + 0.5 - h / 2)
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const d = sd(x, y)
            const strength = (1 - Math.min(Math.max(-d / 10, 0), 1)) ** 2
            const nx = (sd(x + 1, y) - sd(x - 1, y)) / 2
            const ny = (sd(x, y + 1) - sd(x, y - 1)) / 2
            const length = Math.hypot(nx, ny) || 1
            const offset = (y * w + x) * 4
            image.data[offset] = 128 - ((127 * nx) / length) * strength
            image.data[offset + 1] = 128 - ((127 * ny) / length) * strength
            image.data[offset + 3] = 255
        }
    }
    ctx.putImageData(image, 0, 0)
    const result = canvas.toDataURL('image/png')
    if (maps.size >= 24) maps.clear()
    maps.set(key, result)
    return result
}
