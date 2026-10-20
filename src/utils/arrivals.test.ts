import { expect, it } from 'vitest'
import { strings } from '../i18n'
import { arrivalAge, arrivalCountdown, upcomingArrivals } from './arrivals'
import type { Arrival } from '../types/transit'

const now = 1_000_000
const eta = (minutes: number, remark = ''): Arrival => ({ time: now + minutes * 60000, remark })
it('sorts the reported 13, 2, 7 minute order chronologically without mutating the response', () => {
    const input = [eta(13, 'Variant A'), eta(2, 'Variant B'), eta(7, 'Variant C')]
    expect(upcomingArrivals(input)).toEqual([input[1], input[2], input[0]])
    expect(input.map((a) => a.remark)).toEqual(['Variant A', 'Variant B', 'Variant C'])
})
it('limits timed predictions without treating operator messages as departures', () => {
    const input = [{ time: null, remark: 'No service' }, eta(13), eta(7), eta(2), eta(1)]
    expect(upcomingArrivals(input)).toEqual([eta(1), eta(2), eta(7)])
    expect(upcomingArrivals([input[0], eta(2)])).toEqual([eta(2)])
    expect(upcomingArrivals([input[0]])).toEqual([])
})
it('keeps equal-time buses and their remarks', () => {
    const input = [eta(2, 'KMB'), eta(2, 'Citybus')]
    expect(upcomingArrivals(input)).toEqual(input)
    expect(upcomingArrivals([])).toEqual([])
})
it('retains negative, immediate and sub-minute predictions supplied by the operator', () => {
    for (const minutes of [-10, -2, -1.5, -1, -0.5, 0, 0.5]) {
        const input = [eta(6), eta(minutes), eta(14), eta(21)]
        expect(upcomingArrivals(input)).toEqual([input[1], input[0], input[2]])
    }
})

it('formats due through one minute inclusively and rounds later estimates upwards', () => {
    for (const minutes of [-5, 0, 0.5, 1]) {
        expect(arrivalCountdown(now + minutes * 60000, now, strings.tc)).toBe('就到')
        expect(arrivalCountdown(now + minutes * 60000, now, strings.en)).toBe('Due')
    }
    expect(arrivalCountdown(now + 60001, now, strings.en)).toBe('2')
    expect(arrivalCountdown(null, now, strings.en)).toBe('—')
})
it('formats ticking age in both languages without negative ages after a clock correction', () => {
    expect(arrivalAge(now, now + 12345, strings.en)).toBe('Updated 12s ago')
    expect(arrivalAge(now, now + 91000, strings.tc)).toBe('91 秒前更新')
    expect(arrivalAge(now, now - 1000, strings.en)).toBe('Updated 0s ago')
})

it('fills the third slot after a withdrawn ETA without limiting raw response rows first', () => {
    const withdrawn = { time: null, remark: '' }
    const following = [eta(5), eta(14), eta(24)]
    expect(upcomingArrivals([eta(0), ...following])).toEqual([eta(0), eta(5), eta(14)])
    expect(upcomingArrivals([withdrawn, ...following])).toEqual(following)
    expect(upcomingArrivals([withdrawn, ...following.slice(0, 2)])).toEqual(following.slice(0, 2))
})
