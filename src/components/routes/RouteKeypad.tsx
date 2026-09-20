import { Delete, X } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { Copy } from '../../i18n'
export function RouteKeypad({
  t,
  letters,
  setQuery,
  onChange,
}: {
  t: Copy
  letters: string[]
  setQuery: Dispatch<SetStateAction<string>>
  onChange: () => void
}) {
  return (
    <div className="keypad">
      <div className="number-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'delete'].map((key) => (
          <button
            key={key}
            aria-label={key === 'delete' ? t.backspace : key === 'clear' ? t.clear : key}
            className={key.length > 1 ? 'key-action' : ''}
            onClick={() => {
              setQuery((q) =>
                key === 'delete' ? q.slice(0, -1) : key === 'clear' ? '' : (q + key).slice(0, 8),
              )
              onChange()
            }}
          >
            {key === 'delete' ? <Delete size={23} /> : key === 'clear' ? <X size={21} /> : key}
          </button>
        ))}
      </div>
      <div className="letter-keys">
        {letters.map((letter) => (
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
    </div>
  )
}
