import { expect, it } from 'vitest'
import { validNextCharacters } from './routeSearch'

const routes = ['1', '1A', '11X', 'N11', '2B'].map((number) => ({ number }))
it('enables only characters that can extend the existing substring search', () => {
    expect([...validNextCharacters(routes, '1')].sort()).toEqual(['1', 'A', 'X'])
    expect([...validNextCharacters(routes, '11')].sort()).toEqual(['X'])
    expect([...validNextCharacters(routes, '')].sort()).toEqual(['1', '2', 'A', 'B', 'N', 'X'])
})
it('handles empty indexes, complete and invalid queries, and the input length limit', () => {
    expect(validNextCharacters([], '').size).toBe(0)
    expect(validNextCharacters(routes, '1A').size).toBe(0)
    expect(validNextCharacters(routes, '9').size).toBe(0)
    expect(validNextCharacters([{ number: '123456789' }], '12345678').size).toBe(0)
})
