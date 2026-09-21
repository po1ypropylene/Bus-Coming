import type { Bookmark } from '../types/transit'

// Swap adjacent visible items without moving bookmarks hidden by the group filter.
export function moveBookmark(bookmarks: Bookmark[], id: string, direction: -1 | 1, group = '') {
    const visible = bookmarks.filter((b) => !group || b.group === group)
    const index = visible.findIndex((b) => b.id === id)
    const neighbor = visible[index + direction]
    if (index < 0 || !neighbor) return bookmarks
    const from = bookmarks.findIndex((b) => b.id === id)
    const to = bookmarks.findIndex((b) => b.id === neighbor.id)
    const next = [...bookmarks]
    ;[next[from], next[to]] = [next[to], next[from]]
    return next
}

export function saveBookmark(bookmarks: Bookmark[], bookmark: Bookmark) {
    return bookmarks.some((b) => b.id === bookmark.id)
        ? bookmarks.map((b) => (b.id === bookmark.id ? bookmark : b))
        : [...bookmarks, bookmark]
}
