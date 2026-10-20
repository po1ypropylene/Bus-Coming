/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

const source = readFileSync('public/glass-bootstrap.js', 'utf8')
function bootstrap(glass: unknown, contrast = false, storageFails = false) {
    const properties: Record<string, string> = {}
    const root = {
        dataset: {} as Record<string, string>,
        style: {
            setProperty: (name: string, value: string) => {
                properties[name] = value
            },
        },
    }
    runInNewContext(source, {
        document: { documentElement: root },
        localStorage: {
            getItem: () => {
                if (storageFails) throw new Error('Blocked')
                return JSON.stringify({ glass })
            },
        },
        matchMedia: (query: string) => ({ matches: query.includes('contrast') && contrast }),
    })
    return { attributes: root.dataset, properties }
}

it('maps stored intensity and mode before React starts', () => {
    expect(bootstrap({ mode: 'full', intensity: 0.8, refraction: false })).toEqual({
        attributes: { glass: 'full', glassEffective: 'full', refraction: 'false' },
        properties: { '--glass-intensity': '0.8' },
    })
})
it('uses solid auto mode under increased contrast while respecting Full', () => {
    expect(
        bootstrap({ mode: 'auto', intensity: 0.45, refraction: true }, true).attributes
            .glassEffective,
    ).toBe('reduced')
    expect(
        bootstrap({ mode: 'full', intensity: 0.45, refraction: true }, true).attributes
            .glassEffective,
    ).toBe('full')
})
it.each([undefined, null, {}, { mode: 'auto', intensity: 2, refraction: true }])(
    'falls back safely on old or malformed preferences %j',
    (glass) => {
        expect(bootstrap(glass).properties['--glass-intensity']).toBe('0.45')
    },
)
it('starts with usable defaults if storage is blocked', () => {
    expect(bootstrap(undefined, false, true).attributes.glassEffective).toBe('full')
})
it('never introduces an SVG backdrop filter in application styles', () => {
    const css = readFileSync('src/styles/glass.css', 'utf8')
    expect(css).not.toMatch(/backdrop-filter\s*:[^;{}]*url\s*\(/i)
})
