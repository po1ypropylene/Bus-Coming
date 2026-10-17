import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ESLint } from 'eslint'

const directory = await mkdtemp(join(tmpdir(), 'bus-coming-toolchain-'))
const compiler = resolve('node_modules/typescript/bin/tsc')
const oxlint = resolve('node_modules/oxlint/bin/oxlint')
const run = (file, args) => {
    const result = spawnSync(process.execPath, [file, ...args], { encoding: 'utf8' })
    assert.ifError(result.error)
    assert.equal(result.signal, null, result.stderr)
    return { status: result.status, output: result.stdout + result.stderr }
}

try {
    const version = run(compiler, ['--version'])
    assert.equal(version.status, 0, version.output)
    assert.match(version.output, /^Version 7\./)
    const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
    assert.match(lock.packages['node_modules/typescript'].version, /^7\./)
    for (const [path, pkg] of Object.entries(lock.packages)) {
        assert.ok(!path.includes('@typescript/typescript6'), path)
        assert.ok(!path.includes('@typescript/old'), path)
        if (pkg.name === 'typescript' || path.endsWith('/typescript')) {
            assert.match(pkg.version, /^7\./, path)
        }
    }

    const fixture = join(directory, 'probe.ts')
    const config = join(directory, 'tsconfig.json')
    await writeFile(
        config,
        JSON.stringify({
            compilerOptions: { strict: true, noEmit: true, types: [] },
            files: ['probe.ts'],
        }),
    )
    await writeFile(fixture, 'export const count: number = 1\n')
    const valid = run(compiler, ['-p', config])
    assert.equal(valid.status, 0, valid.output)
    await writeFile(fixture, 'export const count: number = "invalid"\n')
    const invalid = run(compiler, ['-p', config])
    assert.notEqual(invalid.status, 0)
    assert.match(invalid.output, /TS2322/)

    const lint = (source) => new ESLint().lintText(source, { filePath: 'src/ToolchainProbe.tsx' })
    const validSource =
        'type Props = { label: string }\nexport function Probe({ label }: Props) {\n' +
        '    return <span>{label}</span>\n}\n'
    const [clean] = await lint(validSource)
    assert.equal(clean.errorCount + clean.warningCount, 0, JSON.stringify(clean.messages))
    const cases = [
        ['prettier/prettier', 'export const value=1;'],
        [
            'react-hooks/rules-of-hooks',
            "import { useState } from 'react'\n" +
                'export function Probe({ show }: { show: boolean }) {\n' +
                '    if (show) useState(0)\n    return null\n}\n',
        ],
        [
            'react-hooks/exhaustive-deps',
            "import { useEffect } from 'react'\n" +
                'export function Probe({ label }: { label: string }) {\n' +
                '    useEffect(() => { console.log(label) }, [])\n    return null\n}\n',
        ],
        [
            'react-refresh/only-export-components',
            'export function Probe() { return <span /> }\nexport function helper() {}\n',
        ],
        [
            'preserve-caught-error',
            'try { JSON.parse("bad") } catch (error) { throw new Error("lost cause") }\n',
        ],
    ]
    for (const [rule, source] of cases) {
        const [result] = await lint(source)
        assert.ok(
            result.messages.some((message) => message.ruleId === rule),
            rule,
        )
        assert.ok(
            !result.messages.some((message) => message.fatal),
            JSON.stringify(result.messages),
        )
    }

    const nativeCases = [
        ['no-explicit-any', 'export const value: any = 1\n'],
        ['no-unused-vars', 'const unused = 1\nexport {}\n'],
        ['no-debugger', 'debugger\n'],
        ['ban-ts-comment', '// @ts-ignore\nexport const value = 1\n'],
    ]
    for (const [rule, source] of nativeCases) {
        await writeFile(fixture, source)
        const result = run(oxlint, ['-c', resolve('.oxlintrc.json'), fixture])
        assert.notEqual(result.status, 0, rule)
        assert.ok(result.output.includes(rule), result.output)
    }
    await writeFile(
        fixture,
        'type Value = { count: number }\nexport const value: Value = { count: 1 }\n',
    )
    const cleanNative = run(oxlint, ['-c', resolve('.oxlintrc.json'), fixture])
    assert.equal(cleanNative.status, 0, cleanNative.output)
    console.log(
        'Toolchain checks passed: native TypeScript 7, no legacy compiler, type errors, ' +
            'TypeScript lint rules, React Hooks, Fast Refresh, caught errors and Prettier',
    )
} finally {
    await rm(directory, { recursive: true, force: true })
}
