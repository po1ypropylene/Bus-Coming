import type { Route } from '../types/transit'

// Match the same substring semantics as route search, including repeated characters.
export function validNextCharacters(routes: Pick<Route, 'number'>[], query: string): Set<string> {
    const available = new Set<string>()
    if (query.length >= 8) return available
    for (const { number } of routes) {
        for (let i = 0; i <= number.length - query.length; i++) {
            if (number.startsWith(query, i) && number[i + query.length]) {
                available.add(number[i + query.length])
            }
        }
    }
    return available
}
