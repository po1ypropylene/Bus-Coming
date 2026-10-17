import { Delete } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { Copy } from '../../i18n'

export function RouteKeypad({
    t,
    letters,
    availableKeys,
    setQuery,
    onChange,
}: {
    t: Copy
    letters: string[]
    availableKeys: Set<string>
    setQuery: Dispatch<SetStateAction<string>>
    onChange: () => void
}) {
    const visibleLetters = letters.filter((letter) => availableKeys.has(letter))
    return (
        <div className="keypad">
            <div className="number-keys">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'delete'].map(
                    (key) => (
                        <button
                            key={key}
                            disabled={key.length === 1 && !availableKeys.has(key)}
                            aria-disabled={key.length === 1 && !availableKeys.has(key)}
                            aria-label={
                                key === 'delete' ? t.backspace : key === 'clear' ? t.clear : key
                            }
                            className={key.length > 1 ? 'key-action' : ''}
                            onClick={() => {
                                setQuery((q) =>
                                    key === 'delete'
                                        ? q.slice(0, -1)
                                        : key === 'clear'
                                          ? ''
                                          : (q + key).slice(0, 8),
                                )
                                onChange()
                            }}
                        >
                            {key === 'delete' ? (
                                <Delete size={23} />
                            ) : key === 'clear' ? (
                                <span>{t.clear}</span>
                            ) : (
                                key
                            )}
                        </button>
                    ),
                )}
            </div>
            {visibleLetters.length > 0 && (
                <div className="letter-keys" key={visibleLetters.join('')}>
                    {visibleLetters.map((letter) => (
                        <button
                            key={letter}
                            onClick={() => {
                                setQuery((q) => (q + letter).slice(0, 8))
                                onChange()
                            }}
                        >
                            {letter}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
