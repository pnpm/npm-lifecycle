import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lifecycle, makeEnv } from '../index.js'
import path from 'path'
import { createRequire } from 'module'

const __dirname = import.meta.dirname
const require = createRequire(import.meta.url)

function noop () {}

function spy () {
  const calls = []
  const fn = (...args) => { calls.push(args) }
  fn.calls = calls
  fn.calledWithMatch = (...matchers) => calls.some(call =>
    matchers.every((m, i) => {
      if (typeof m === 'string') return typeof call[i] === 'string' && call[i].includes(m)
      return call[i] === m
    })
  )
  return fn
}

function makeLog (overrides = {}) {
  return {
    level: 'silent',
    info: noop,
    warn: noop,
    silly: overrides.silly || spy(),
    verbose: overrides.verbose || spy(),
    pause: noop,
    resume: noop,
    clearProgress: noop,
    showProgress: noop,
    ...overrides
  }
}

test('runs scripts from .hooks directory even if no script is present in package.json', { skip: process.platform === 'win32' && 'hook scripts without extensions do not work on Windows' }, async () => {
  const fixture = path.join(__dirname, 'fixtures', 'has-hooks')
  const verbose = spy()
  const log = makeLog({ verbose })
  const dir = path.join(fixture, 'node_modules')
  const pkg = require(path.join(fixture, 'package.json'))

  await lifecycle(pkg, 'postinstall', fixture, {
    stdio: 'pipe',
    log,
    dir,
    config: {}
  })

  assert.ok(
    verbose.calledWithMatch('lifecycle', 'undefined~postinstall:', 'stdout', 'ran hook'),
    'ran postinstall hook'
  )
})

test("reports child's output", async () => {
  const fixture = path.join(__dirname, 'fixtures', 'count-to-10')
  const verbose = spy()
  const silly = spy()
  const log = makeLog({ verbose, silly })
  const dir = path.join(__dirname, '..')
  const pkg = require(path.resolve(fixture, 'package.json'))

  await lifecycle(pkg, 'postinstall', fixture, {
    stdio: 'pipe',
    log,
    dir,
    config: {}
  })

  assert.ok(
    verbose.calledWithMatch('lifecycle', 'undefined~postinstall:', 'stdout', 'line 1'),
    'stdout reported'
  )
  assert.ok(
    verbose.calledWithMatch('lifecycle', 'undefined~postinstall:', 'stdout', 'line 2'),
    'stdout reported'
  )
  assert.ok(
    verbose.calledWithMatch('lifecycle', 'undefined~postinstall:', 'stderr', 'some error'),
    'stderr reported'
  )
  assert.ok(
    verbose.calledWithMatch('lifecycle', 'undefined~postinstall:', 'stdout', 'package.json'),
    'package json reported'
  )
  assert.ok(
    silly.calledWithMatch('lifecycle', 'undefined~postinstall:', 'Returned: code:', 0, ' signal:', null),
    'exit code reported'
  )
})

test('makeEnv', () => {
  const pkg = {
    name: 'myPackage',
    version: '1.0.0',
    contributors: [{ name: 'Mike Sherov', email: 'beep@boop.com' }]
  }
  const config = {
    enteente: Infinity,
    _privateVar: 1,
    '_myPackage:myPrivateVar': 1,
    'myPackage:bar': 2,
    'myPackage:foo': 3,
    'myPackage@1.0.0:baz': 4,
    'myPackage@1.0.0:foo': 5
  }

  const env = makeEnv(pkg, {
    config,
    nodeOptions: '--inspect-brk --abort-on-uncaught-exception'
  }, null, process.env)

  assert.equal(env.npm_package_name, 'myPackage', 'package data is included')
  assert.equal(env.npm_config_enteente, undefined, 'config is not included as npm_config_')
  assert.equal(env.pnpm_config_enteente, undefined, 'config is not included as pnpm_config_')
  assert.equal(env.npm_package_config_myPrivateVar, undefined, 'package-specific config overrides are not set')
  assert.equal(env.npm_package_config_bar, undefined, 'package-specific config overrides are not set')
  assert.equal(env.NODE_OPTIONS, '--inspect-brk --abort-on-uncaught-exception', 'nodeOptions sets NODE_OPTIONS')
})

test('throw error signal kills child', async (t) => {
  const fixture = path.join(__dirname, 'fixtures', 'count-to-10')
  const verbose = spy()
  const silly = spy()
  const originalKill = process.kill
  process.kill = noop
  t.after(() => { process.kill = originalKill })

  const log = makeLog({ verbose, silly })
  const pkg = require(path.join(fixture, 'package.json'))

  await assert.rejects(() =>
    lifecycle(pkg, 'signal-abrt', fixture, {
      stdio: 'pipe',
      log,
      dir: fixture,
      config: {}
    })
  )
})

test('exit with error on INT signal from child', { skip: process.platform === 'win32' && 'no SIGINT on Windows' }, async (t) => {
  const fixture = path.join(__dirname, 'fixtures', 'count-to-10')
  const verbose = spy()
  const silly = spy()
  const info = spy()
  const killCalls = []
  const originalKill = process.kill
  process.kill = (...args) => { killCalls.push(args) }
  t.after(() => { process.kill = originalKill })

  const log = makeLog({ verbose, silly, info })
  const pkg = require(path.join(fixture, 'package.json'))

  await assert.rejects(() =>
    lifecycle(pkg, 'signal-int', fixture, {
      stdio: 'pipe',
      log,
      dir: fixture,
      config: {}
    })
  )

  assert.ok(
    info.calledWithMatch('lifecycle', 'undefined~signal-int:', 'Failed to exec signal-int script'),
    'INT signal not intercepted'
  )
  assert.ok(
    silly.calledWithMatch('lifecycle', 'undefined~signal-int:', 'Returned: code:', null, ' signal:', 'SIGINT'),
    'INT signal reported'
  )
})
