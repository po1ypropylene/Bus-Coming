import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import type { Bookmark, Lang } from '../../types/transit'
import type { Copy } from '../../i18n'

export function BookmarkOrder({
                                  bookmarks,
                                  lang,
                                  t,
                                  onMove,
                              }: {
    bookmarks: Bookmark[]
    lang: Lang
    t: Copy
    onMove: (id: string, direction: -1 | 1) => void
}) {
    const [announcement, setAnnouncement] = useState('')
    return (
        <>
            <p className="muted-text">{t.reorderHint}</p>
            <ol className="bookmark-order-list">
                {bookmarks.map((bookmark, index) => {
                    const label = `${bookmark.route.number} · ${bookmark.stop.name[lang]} · ${bookmark.route.destination[lang]}`
                    const move = (direction: -1 | 1) => {
                        onMove(bookmark.id, direction)
                        setAnnouncement(
                            `${label} · ${t.position} ${index + direction + 1} / ${bookmarks.length}`,
                        )
                    }
                    return (
                        <li key={bookmark.id}>
                            <span className="bookmark-order-copy">
                                <strong>
                                    {bookmark.route.number} · {bookmark.stop.name[lang]}
                                </strong>
                                <small>
                                    {t.toward} {bookmark.route.destination[lang]}
                                </small>
                            </span>
                            <div className="bookmark-order-actions">
                                <button
                                    className="icon-button"
                                    aria-label={`${t.moveUp}: ${label}`}
                                    disabled={index === 0}
                                    onClick={() => move(-1)}
                                >
                                    <ArrowUp size={20}/>
                                </button>
                                <button
                                    className="icon-button"
                                    aria-label={`${t.moveDown}: ${label}`}
                                    disabled={index === bookmarks.length - 1}
                                    onClick={() => move(1)}
                                >
                                    <ArrowDown size={20}/>
                                </button>
                            </div>
                        </li>
                    )
                })}
            </ol>
            <span className="visually-hidden" role="status" aria-live="polite">
                {announcement}
            </span>
        </>
    )
}
