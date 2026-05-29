// GSD-2 — Unit tests for parseCliArgs (canonical CLI flag parser)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildHeadlessAutoArgs, parseCliArgs } from '../cli-args.ts'

function parse(...args: string[]) {
  return parseCliArgs(['node', 'gsd', ...args])
}

describe('parseCliArgs — modes', () => {
  test('accepts mcp mode (added during refactor)', () => {
    assert.equal(parse('--mode', 'mcp').mode, 'mcp')
  })

  test('still accepts text/json/rpc modes', () => {
    assert.equal(parse('--mode', 'text').mode, 'text')
    assert.equal(parse('--mode', 'json').mode, 'json')
    assert.equal(parse('--mode', 'rpc').mode, 'rpc')
  })

  test('ignores unknown mode values', () => {
    assert.equal(parse('--mode', 'bogus').mode, undefined)
  })
})

describe('buildHeadlessAutoArgs', () => {
  test('preserves auto positional args without a model override', () => {
    const args = buildHeadlessAutoArgs({ messages: ['auto', 'next'] })
    assert.deepEqual(args, ['auto', 'next'])
  })

  test('forwards --model before auto positional args', () => {
    const args = buildHeadlessAutoArgs({
      model: 'claude-code/sonnet',
      messages: ['auto', 'next'],
    })
    assert.deepEqual(args, ['--model', 'claude-code/sonnet', 'auto', 'next'])
  })
})

describe('parseCliArgs — worktree flag', () => {
  test('-w with no value sets worktree=true', () => {
    assert.equal(parse('-w').worktree, true)
  })

  test('--worktree with no value sets worktree=true', () => {
    assert.equal(parse('--worktree').worktree, true)
  })

  test('-w followed by a name captures the name', () => {
    assert.equal(parse('-w', 'feature-x').worktree, 'feature-x')
  })

  test('--worktree followed by a name captures the name', () => {
    assert.equal(parse('--worktree', 'feature-x').worktree, 'feature-x')
  })

  test('-w followed by another flag does not consume the flag', () => {
    const flags = parse('-w', '--print')
    assert.equal(flags.worktree, true)
    assert.equal(flags.print, true)
  })

  test('worktree is undefined when flag not passed', () => {
    assert.equal(parse('hello').worktree, undefined)
  })
})

describe('parseCliArgs — short flags and basic options', () => {
  test('-p sets print', () => {
    assert.equal(parse('-p').print, true)
  })

  test('--print sets print', () => {
    assert.equal(parse('--print').print, true)
  })

  test('-c sets continue', () => {
    assert.equal(parse('-c').continue, true)
  })

  test('--no-session sets noSession', () => {
    assert.equal(parse('--no-session').noSession, true)
  })

  test('--model captures model id', () => {
    assert.equal(parse('--model', 'claude-opus-4-6').model, 'claude-opus-4-6')
  })
})

describe('parseCliArgs — list flags and accumulators', () => {
  test('--extension accumulates multiple values', () => {
    const flags = parse('--extension', 'a', '--extension', 'b')
    assert.deepEqual(flags.extensions, ['a', 'b'])
  })

  test('--tools splits comma-separated list', () => {
    assert.deepEqual(parse('--tools', 'read,write,edit').tools, ['read', 'write', 'edit'])
  })

  test('--list-models with no value sets to true', () => {
    assert.equal(parse('--list-models').listModels, true)
  })

  test('--list-models with provider filter captures provider', () => {
    assert.equal(parse('--list-models', 'anthropic').listModels, 'anthropic')
  })

  test('--list-models followed by another flag does not consume it', () => {
    const flags = parse('--list-models', '--print')
    assert.equal(flags.listModels, true)
    assert.equal(flags.print, true)
  })
})

describe('parseCliArgs — positional messages', () => {
  test('non-flag positional args become messages', () => {
    const flags = parse('hello', 'world')
    assert.deepEqual(flags.messages, ['hello', 'world'])
  })

  test('messages and flags can be interleaved', () => {
    const flags = parse('hello', '--print', 'world')
    assert.deepEqual(flags.messages, ['hello', 'world'])
    assert.equal(flags.print, true)
  })

  test('default messages and extensions are empty arrays', () => {
    const flags = parse()
    assert.deepEqual(flags.messages, [])
    assert.deepEqual(flags.extensions, [])
  })
})
