import { Bookmark as BookmarkIcon, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { RouteBadge } from '../../components/routes/RouteBadge'
import { type Copy, strings } from '../../i18n'
import { type Bookmark } from '../../types/transit'

export function SaveDialog({
    item,
    groups,
    t,
    onClose,
    onSave,
}: {
    item: Bookmark
    groups: string[]
    t: Copy
    onClose: () => void
    onSave: (group: string) => void
}) {
    const dialog = useRef<HTMLDialogElement>(null)
    const id = useId()
    const pressedOutside = useRef(false)
    const [group, setGroup] = useState(item.group)
    useEffect(() => {
        const element = dialog.current!
        element.showModal()
        return () => element.close()
    }, [])
    const outside = (event: PointerEvent<HTMLDialogElement>) => {
        const rect = event.currentTarget.getBoundingClientRect()
        return (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
        )
    }
    const close = () => dialog.current?.close()
    return (
        <dialog
            ref={dialog}
            className="save-dialog"
            aria-labelledby={`${id}-title`}
            closedby="any"
            onClose={(event) => {
                if (!event.currentTarget.open) onClose()
            }}
            onPointerDown={(event) => {
                // Safari needs a fallback; padding is part of the sheet, not the backdrop.
                pressedOutside.current = event.button === 0 && outside(event)
            }}
            onPointerUp={(event) => {
                if (
                    !('closedBy' in HTMLDialogElement.prototype) &&
                    pressedOutside.current &&
                    outside(event)
                )
                    close()
                pressedOutside.current = false
            }}
            onPointerCancel={() => (pressedOutside.current = false)}
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    close()
                    onSave(group.trim())
                }}
            >
                <div className="sheet-handle" />
                <div className="sheet-header">
                    <h2 id={`${id}-title`}>{t.save}</h2>
                    <button
                        type="button"
                        className="icon-button"
                        onClick={close}
                        aria-label={t.close}
                    >
                        <X />
                    </button>
                </div>
                <div className="save-preview">
                    <RouteBadge route={item.route} />
                    <span>{item.stop.name[t === strings.tc ? 'tc' : 'en']}</span>
                </div>
                <label htmlFor={`${id}-group`}>{t.group}</label>
                <input
                    ref={(element) => {
                        // React's autoFocus runs before showModal; use native dialog autofocus.
                        if (element) element.autofocus = true
                    }}
                    id={`${id}-group`}
                    name="group"
                    aria-describedby={`${id}-hint`}
                    maxLength={80}
                    placeholder={t.groupPlaceholder}
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                />
                {groups.length > 0 && (
                    <div className="chips">
                        {groups.map((g) => (
                            <button
                                type="button"
                                className={g === group ? 'chip active' : 'chip'}
                                aria-pressed={g === group}
                                key={g}
                                onClick={() => setGroup(g)}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                )}
                <p className="muted-text" id={`${id}-hint`}>
                    {t.groupHint}
                </p>
                <button className="primary full" type="submit">
                    <BookmarkIcon size={18} />
                    {t.done}
                </button>
                <button className="text-button full" type="button" onClick={close}>
                    {t.cancel}
                </button>
            </form>
        </dialog>
    )
}
