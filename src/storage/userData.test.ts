import { afterEach, describe, expect, it, vi } from 'vitest'
import { readUser } from './userData'

afterEach(() => vi.unstubAllGlobals())

describe('stored theme defaults', () => {
    it('starts in blue and follows the browser language without writing storage', () => {
        const setItem = vi.fn()
        vi.stubGlobal('localStorage', { getItem: () => null, setItem })
        vi.stubGlobal('navigator', { language: 'zh-HK' })
        expect(readUser()).toEqual({
            user: { version: 1, theme: 'blue', language: 'tc', bookmarks: [] },
            error: false,
        })
        expect(setItem).not.toHaveBeenCalled()
    })

    it.each([undefined, 'green', 'purple'])('preserves saved data with theme %s', (theme) => {
        const stored = JSON.stringify({ version: 1, theme, language: 'tc', bookmarks: [] })
        const setItem = vi.fn()
        vi.stubGlobal('localStorage', { getItem: () => stored, setItem })
        expect(readUser()).toEqual({
            user: { version: 1, theme: theme ?? 'blue', language: 'tc', bookmarks: [] },
            error: false,
        })
        expect(setItem).not.toHaveBeenCalled()
    })

    it('uses blue after a storage failure without clearing the unreadable record', () => {
        const clear = vi.fn()
        vi.stubGlobal('localStorage', {
            getItem: () => {
                throw new Error('Storage unavailable')
            },
            clear,
        })
        expect(readUser()).toEqual({
            user: { version: 1, theme: 'blue', language: 'en', bookmarks: [] },
            error: true,
        })
        expect(clear).not.toHaveBeenCalled()
    })
})
