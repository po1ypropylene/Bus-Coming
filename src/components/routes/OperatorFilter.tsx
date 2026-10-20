import { useRef } from 'react'
import { useApp } from '../../app/AppContext'
import { PROVIDERS } from '../../types/transit'
import { SelectionLens } from '../glass/SelectionLens'

export function OperatorFilter() {
    const { operator, setOperator, setLimit, t, tc } = useApp()
    const host = useRef<HTMLDivElement>(null)
    const options = ['all', ...PROVIDERS]
    const labels = [
        t.all,
        tc ? '九巴/龍運' : 'KMB/LWB',
        tc ? '城巴' : 'Citybus',
        tc ? '嶼巴' : 'NLB',
    ]
    return (
        <div
            ref={host}
            className="operator-tabs"
            data-operator={operator}
            aria-label={t.allOperators}
        >
            {options.map((co, index) => (
                <button
                    key={co}
                    aria-pressed={operator === co}
                    className={operator === co ? 'selected' : ''}
                    onClick={() => {
                        setOperator(co)
                        setLimit(40)
                    }}
                >
                    {labels[index]}
                </button>
            ))}
            <SelectionLens host={host} index={options.indexOf(operator)} count={4}>
                {labels.map((label) => (
                    <span className="operator-label" key={label}>
                        {label}
                    </span>
                ))}
            </SelectionLens>
        </div>
    )
}
