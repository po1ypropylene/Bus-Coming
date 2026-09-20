import { Bookmark as BookmarkIcon, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
    const [group, setGroup] = useState(item.group)
    useEffect(() => {
        dialog.current?.showModal()
    }, [])
    return (
        <dialog
            ref={dialog}
            className="save-dialog"
            onCancel={onClose}
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    onSave(group.trim())
                }}
            >
                <div className="sheet-handle" />
                <div className="sheet-header">
                    <h2>{t.save}</h2>
                    <button
                        type="button"
                        className="icon-button"
                        onClick={onClose}
                        aria-label={t.close}
                    >
                        <X />
                    </button>
                </div>
                <div className="save-preview">
                    <RouteBadge route={item.route} />
                    <span>{item.stop.name[t === strings.tc ? 'tc' : 'en']}</span>
                </div>
                <label htmlFor="group-name">{t.group}</label>
                <input
                    autoFocus
                    id="group-name"
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
                                key={g}
                                onClick={() => setGroup(g)}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                )}
                <p className="muted-text">{t.groupHint}</p>
                <button className="primary full" type="submit">
                    <BookmarkIcon size={18} />
                    {t.done}
                </button>
                <button className="text-button full" type="button" onClick={onClose}>
                    {t.cancel}
                </button>
            </form>
        </dialog>
    )
}
