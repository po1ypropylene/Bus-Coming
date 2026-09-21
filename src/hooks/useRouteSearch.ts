import { useMemo, useState } from 'react'
import { FALLBACK_LETTERS, type Route, type Snapshot } from '../types/transit'
import { routeLetters } from '../utils/transit'

export function useRouteSearch(routes: Route[], snapshots: Snapshot[]) {
    const [query, setQuery] = useState('')
    const [operator, setOperator] = useState('all')
    const [limit, setLimit] = useState(40)
    const [keypad, setKeypad] = useState(true)
    const letters = useMemo(() => {
        const actual = routeLetters(routes)
        return snapshots.length === 3
            ? actual
            : [...new Set([...FALLBACK_LETTERS, ...actual])].sort()
    }, [routes, snapshots.length])
    const filtered = useMemo(
        () =>
            routes
                .filter(
                    (r) =>
                        (operator === 'all' ||
                            r.provider === operator ||
                            r.jointPartners?.some((p) => p.provider === operator)) &&
                        r.number.includes(query),
                )
                .sort((a, b) => Number(b.number === query) - Number(a.number === query)),
        [routes, query, operator],
    )
    return {
        query,
        setQuery,
        operator,
        setOperator,
        limit,
        setLimit,
        keypad,
        setKeypad,
        letters,
        filtered,
    }
}
