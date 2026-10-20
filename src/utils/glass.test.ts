import { describe, expect, it } from 'vitest'
import { DEFAULT_GLASS, FrameBudget, nextFilterId, springStep, validGlass } from './glass'
import { validateUserData } from './transit'

const user = { version: 1, language: 'tc', bookmarks: [] }
describe('glass preferences and migration', () => {
    it('keeps old backups and defaults without changing their storage schema', () => {
        expect(validateUserData(user)).toEqual({ ...user, theme: 'blue' })
        expect(validGlass(DEFAULT_GLASS)).toBe(true)
    })
    it('round-trips explicit preferences', () => {
        const data = { ...user, glass: { intensity: 0, mode: 'reduced', refraction: false } }
        expect(validateUserData(JSON.parse(JSON.stringify(data))).glass).toEqual(data.glass)
    })
    it.each([
        null,
        {},
        { ...DEFAULT_GLASS, intensity: -1 },
        { ...DEFAULT_GLASS, intensity: 1.1 },
        { ...DEFAULT_GLASS, intensity: NaN },
        { ...DEFAULT_GLASS, mode: 'unknown' },
        { ...DEFAULT_GLASS, refraction: 1 },
    ])('rejects malformed settings %j', (glass) => {
        expect(() => validateUserData({ ...user, glass })).toThrow('Invalid backup')
    })
})
it('rotates filter identity without reusing IDs', () => {
    expect(new Set(Array.from({ length: 100 }, nextFilterId)).size).toBe(100)
})
it('clamps long spring frames and settles on the target', () => {
    expect(springStep(0, 0, 100, 10)).toEqual(springStep(0, 0, 100, 1 / 30))
    let state = { position: 0, velocity: 0 }
    for (let i = 0; i < 180; i++) state = springStep(state.position, state.velocity, 100, 1 / 60)
    expect(state.position).toBeCloseTo(100, 3)
    expect(state.velocity).toBeCloseTo(0, 3)
})
it('degrades on a slow two-second animation sample, but not a healthy sample', () => {
    const slow = new FrameBudget(),
        fast = new FrameBudget()
    for (let i = 0; i < 49; i++) expect(slow.add(40)).toBe(false)
    expect(slow.add(40)).toBe(true)
    for (let i = 0; i < 125; i++) expect(fast.add(16)).toBe(false)
    for (let i = 0; i < 49; i++) expect(fast.add(40)).toBe(false)
    expect(fast.add(40)).toBe(true)
})
