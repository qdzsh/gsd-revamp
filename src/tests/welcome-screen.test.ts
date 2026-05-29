/**
 * Welcome screen unit tests.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { homedir } from 'node:os'

import { buildWelcomeScreenLines, printWelcomeScreen } from '../welcome-screen.ts'

function capture(opts: Parameters<typeof printWelcomeScreen>[0]): string {
  const chunks: string[] = []
  const original = process.stderr.write.bind(process.stderr)
  ;(process.stderr as any).write = (chunk: string) => { chunks.push(chunk); return true }
  const origIsTTY = (process.stderr as any).isTTY
  ;(process.stderr as any).isTTY = true

  try {
    printWelcomeScreen(opts)
  } finally {
    ;(process.stderr as any).write = original
    ;(process.stderr as any).isTTY = origIsTTY
  }

  return chunks.join('')
}

function strip(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

test('renders GSD-Revamp logo and dynamic version', () => {
  const out = strip(capture({ version: '2.38.0', width: 180 }))
  assert.ok(out.includes('██████╗ ███████╗██████╗       ██████╗'), 'GSD-Revamp logo top row missing')
  assert.ok(out.includes('GSD-Revamp CLI v2.38.0'), 'dynamic version missing')
})

test('renders workspace path, model info, and MCP rows', (t) => {
  const originalBraveApiKey = process.env.BRAVE_API_KEY
  const originalContext7ApiKey = process.env.CONTEXT7_API_KEY
  process.env.BRAVE_API_KEY = 'test-brave'
  process.env.CONTEXT7_API_KEY = 'test-context7'
  t.after(() => {
    if (originalBraveApiKey === undefined) delete process.env.BRAVE_API_KEY
    else process.env.BRAVE_API_KEY = originalBraveApiKey
    if (originalContext7ApiKey === undefined) delete process.env.CONTEXT7_API_KEY
    else process.env.CONTEXT7_API_KEY = originalContext7ApiKey
  })

  const out = strip(capture({
    version: '1.0.0',
    width: 180,
    modelName: 'gpt-5.5',
    provider: 'openai-codex',
    authMode: 'apiKey',
    thinkingLevel: 'high',
  }))

  const cwd = process.cwd()
  const shortCwd = cwd.startsWith(homedir()) ? '~' + cwd.slice(homedir().length) : cwd
  assert.ok(out.includes(`Workspace: ${shortCwd}`), 'workspace path missing')
  assert.ok(out.includes('Model: gpt-5.5 · high'), 'model info missing')
  assert.ok(!out.includes('openai-codex'), 'provider should be omitted from model info')
  assert.ok(out.includes('MCP:'), 'MCP row missing')
  assert.ok(out.includes('MCP: Brave ✓ · Context7 ✓'), 'MCP separator should use single spaces')
})

test('omits thinking suffix when thinking is off', () => {
  const out = strip(capture({
    version: '1.0.0',
    width: 180,
    modelName: 'gpt-5.5',
    provider: 'openai-codex',
    authMode: 'apiKey',
    thinkingLevel: 'off',
  }))

  assert.ok(out.includes('gpt-5.5'), 'model info missing')
  assert.ok(!out.includes('openai-codex'), 'provider should be omitted from model info')
  assert.ok(!out.includes('thinking off'), 'off thinking should not be rendered in welcome header')
})

test('renders remote channel in MCP row', () => {
  const out = strip(capture({ version: '1.0.0', width: 180, remoteChannel: 'discord' }))
  assert.ok(out.includes('Discord'), 'remote channel name missing')
})

test('omits remote channel when not provided', () => {
  const out = strip(capture({ version: '1.0.0', width: 180 }))
  assert.ok(!out.includes('Discord'), 'should not show Discord when no remote')
  assert.ok(!out.includes('Slack'), 'should not show Slack when no remote')
  assert.ok(!out.includes('Telegram'), 'should not show Telegram when no remote')
})

test('does not render a bottom border rule', () => {
  const out = strip(buildWelcomeScreenLines({ version: '1.0.0', width: 180 }).join('\n'))
  const ruleLines = out.split('\n').filter((line) => /^─+$/.test(line.trim()))
  assert.equal(ruleLines.length, 0, 'welcome header should not include a bottom border rule')
})

test('falls back to compact text on narrow terminals', () => {
  const out = buildWelcomeScreenLines({ version: '1.0.0', width: 60 })
  const cwd = process.cwd()
  const shortCwd = cwd.startsWith(homedir()) ? '~' + cwd.slice(homedir().length) : cwd
  assert.deepEqual(out, [
    'GSD-Revamp CLI v1.0.0',
    shortCwd,
  ])
})

test('skips when not a TTY', (t) => {
  const chunks: string[] = []
  const original = process.stderr.write.bind(process.stderr)
  ;(process.stderr as any).write = (chunk: string) => { chunks.push(chunk); return true }
  const origIsTTY = (process.stderr as any).isTTY
  ;(process.stderr as any).isTTY = false

  t.after(() => {
    ;(process.stderr as any).write = original
    ;(process.stderr as any).isTTY = origIsTTY
  });

  printWelcomeScreen({ version: '1.0.0' })
  assert.equal(chunks.join(''), '', 'should produce no output when not TTY')
})
