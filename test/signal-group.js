import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lifecycle } from '../index.js'
import { spawnSync } from 'child_process'
import path from 'path'
import { createRequire } from 'module'

const __dirname = import.meta.dirname
const require = createRequire(import.meta.url)

function noop () {}

// Resolves once the child's "ready" line has been observed on stdout, so the
// test doesn't send a signal before the child installed its own SIGINT handler.
function waitForReady (verboseCalls) {
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (verboseCalls.some(call => typeof call[3] === 'string' && call[3].includes('ready'))) {
        clearInterval(timer)
        resolve()
      }
    }, 5)
  })
}

function makeLog () {
  const verboseCalls = []
  return {
    log: {
      level: 'silent',
      info: noop,
      warn: noop,
      silly: noop,
      verbose: (...args) => { verboseCalls.push(args) },
      pause: noop,
      resume: noop,
      clearProgress: noop,
      showProgress: noop
    },
    verboseCalls
  }
}

test(
  'a signal delivered to our process group does not also reach the child directly',
  { skip: process.platform === 'win32' && 'no SIGINT/process groups on Windows' },
  () => {
    // Run in a detached driver process so process.kill(0, 'SIGINT') (a real
    // analogue of a terminal delivering Ctrl-C to the whole foreground process
    // group) only reaches this driver, not the test runner's own process tree.
    const driver = path.join(__dirname, 'fixtures', 'graceful-sigint', 'drive-group-signal.mjs')
    const { stdout } = spawnSync(process.execPath, [driver], { detached: true, encoding: 'utf8' })

    assert.match(stdout, /RESULT outcome=resolved cleanedUp=true/,
      'child should finish its cleanup instead of being killed by a redundant direct-plus-forwarded signal')
  }
)

test(
  'a signal delivered only to our pid is forwarded to the child',
  { skip: process.platform === 'win32' && 'no SIGINT/process groups on Windows' },
  async () => {
    const fixture = path.join(__dirname, 'fixtures', 'graceful-sigint')
    const pkg = require(path.join(fixture, 'package.json'))
    const { log, verboseCalls } = makeLog()

    const result = lifecycle(pkg, 'graceful', fixture, { stdio: 'pipe', log, dir: fixture, config: {} })

    await waitForReady(verboseCalls)
    // Targets only this process, the way a supervisor (systemd, Kubernetes)
    // would, not the process group a terminal's Ctrl-C would use.
    process.kill(process.pid, 'SIGINT')

    await assert.doesNotReject(result)
    assert.ok(
      verboseCalls.some(call => typeof call[3] === 'string' && call[3].includes('cleanup finished')),
      'the child never sees the signal on its own here, so the explicit forward must still happen'
    )
  }
)

test(
  'a compound shell command is interrupted, not just its own sh process',
  { skip: process.platform === 'win32' && 'no SIGINT/process groups on Windows' },
  async () => {
    // `sleep 5 && echo done` forks sleep as its own process, still in sh's
    // process group. Forwarding SIGINT only to sh's pid doesn't reach it, so
    // the chain runs to completion instead of stopping.
    const fixture = path.join(__dirname, 'fixtures', 'compound-sigint')
    const pkg = require(path.join(fixture, 'package.json'))
    const { log } = makeLog()

    const start = Date.now()
    const result = lifecycle(pkg, 'chained', fixture, { stdio: 'pipe', log, dir: fixture, config: {} })

    setTimeout(() => process.kill(process.pid, 'SIGINT'), 300)

    await assert.rejects(result)
    assert.ok(Date.now() - start < 3000, 'sleep 5 should be interrupted well before it finishes on its own')
  }
)
