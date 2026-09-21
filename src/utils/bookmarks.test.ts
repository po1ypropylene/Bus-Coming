import { expect, it } from 'vitest'
import type { Bookmark } from '../types/transit'
import { moveBookmark, saveBookmark } from './bookmarks'

const bookmarks = [
    { id: 'a', group: 'Work' },
    { id: 'b', group: 'Home' },
    { id: 'c', group: 'Work' },
    { id: 'd', group: 'Home' },
] as Bookmark[]
const ids = (items: Bookmark[]) => items.map((b) => b.id)

it('moves bookmarks in either direction without mutating saved records', () => {
    expect(ids(moveBookmark(bookmarks, 'c', -1))).toEqual(['a', 'c', 'b', 'd'])
    expect(ids(moveBookmark(bookmarks, 'a', 1))).toEqual(['b', 'a', 'c', 'd'])
    expect(ids(bookmarks)).toEqual(['a', 'b', 'c', 'd'])
    expect(moveBookmark(bookmarks, 'a', -1)).toBe(bookmarks)
    expect(moveBookmark(bookmarks, 'd', 1)).toBe(bookmarks)
    expect(moveBookmark(bookmarks, 'missing', 1)).toBe(bookmarks)
})
it('swaps only visible group positions and leaves hidden bookmarks in place', () => {
    expect(ids(moveBookmark(bookmarks, 'c', -1, 'Work'))).toEqual(['c', 'b', 'a', 'd'])
    expect(moveBookmark(bookmarks, 'b', 1, 'Work')).toBe(bookmarks)
    expect(moveBookmark(bookmarks, 'c', 1, 'Work')).toBe(bookmarks)
})
it('editing a bookmark preserves its position; new bookmarks append', () => {
    const edited = { ...bookmarks[1], group: 'Work' }
    const result = saveBookmark(bookmarks, edited)
    expect(ids(result)).toEqual(ids(bookmarks))
    expect(result[1]).toEqual(edited)
    expect(bookmarks[1].group).toBe('Home')
    expect(ids(saveBookmark(bookmarks, { ...edited, id: 'new' }))).toEqual([
        'a',
        'b',
        'c',
        'd',
        'new',
    ])
})
