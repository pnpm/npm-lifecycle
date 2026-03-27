import { test } from 'tap'
import sinon from 'sinon'
import { lifecycle, makeEnv } from '../index.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import isWindows from 'is-windows'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

function noop () {}

test('runs scripts from .hooks directory even if no script is present in package.json', function (t) {
  const fixture = path.join(__dirname, 'fixtures', 'has-hooks')

  const verbose = sinon.spy()
  const silly = sinon.spy()
  const log = {
    level: 'silent',
    info: noop,
    warn: noop,
    silly,
    verbose,
    pause: noop,
    resume: noop,
    clearProgress: noop,
    showProgress: noop
  }
  const dir = path.join(fixture, 'node_modules')

  const pkg = require(path.join(fixture, 'package.json'))

  lifecycle(pkg, 'postinstall', fixture, {
    stdio: 'pipe',
    log,
    dir,
    config: {}
  })
    .then(() => {
      t.ok(
        verbose.calledWithMatch(
          'lifecycle',
          'undefined~postinstall:',
          'stdout',
          'ran hook'
        ),
        'ran postinstall hook'
      )

      t.end()
    })
    .catch(t.end)
})

test("reports child's output", async (t) => {
  const fixture = path.join(__dirname, 'fixtures', 'count-to-10')

  const verbose = sinon.spy()
  const silly = sinon.spy()
  const log = {
    level: 'silent',
    info: noop,
    warn: noop,
    silly,
    verbose,
    pause: noop,
    resume: noop,
    clearProgress: noop,
    showProgress: noop
  }
  const dir = path.join(__dirname, '..')

  const pkgFileName = path.resolve(fixture, 'package.json')
  const pkg = require(pkgFileName)

  await lifecycle(pkg, 'postinstall', fixture, {
    stdio: 'pipe',
    log,
    dir,
    config: {}
  })
  t.ok(
    verbose.calledWithMatch(
      'lifecycle',
      'undefined~postinstall:',
      'stdout',
      'line 1'
    ),
    'stdout reported'
  )
  t.ok(
    verbose.calledWithMatch(
      'lifecycle',
      'undefined~postinstall:',
      'stdout',
      'line 2'
    ),
    'stdout reported'
  )
  t.ok(
    verbose.calledWithMatch(
      'lifecycle',
      'undefined~postinstall:',
      'stderr',
      'some error'
    ),
    'stderr reported'
  )
  t.ok(
    verbose.calledWithMatch(
      'lifecycle',
      'undefined~postinstall:',
      'stdout',
      'package.json'
    ),
    'package json reported'
  )
  t.ok(
    silly.calledWithMatch(
      'lifecycle',
      'undefined~postinstall:',
      'Returned: code:',
      0,
      ' signal:',
      null
    ),
    'exit code reported'
  )

  t.end()
})

// WARNING! For some reason, when this test runs first,
// the "reports child's output" fails
test('makeEnv', function (t) {
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

  t.equal('myPackage', env.npm_package_name, 'package data is included')

  t.equal(undefined, env.npm_config_enteente, 'config is not included as npm_config_')
  t.equal(undefined, env.pnpm_config_enteente, 'config is not included as pnpm_config_')

  t.equal(undefined, env.npm_package_config_myPrivateVar, 'package-specific config overrides are not set')
  t.equal(undefined, env.npm_package_config_bar, 'package-specific config overrides are not set')

  t.equal('--inspect-brk --abort-on-uncaught-exception', env.NODE_OPTIONS, 'nodeOptions sets NODE_OPTIONS')
  t.end()
})

test('throw error signal kills child', async function (t) {
  const fixture = path.join(__dirname, 'fixtures', 'count-to-10')

  const verbose = sinon.spy()
  const silly = sinon.spy()

  const stubProcessExit = sinon.stub(process, 'kill').callsFake(noop)

  const log = {
    level: 'silent',
    info: noop,
    warn: noop,
    silly,
    verbose,
    pause: noop,
    resume: noop,
    clearProgress: noop,
    showProgress: noop
  }

  const dir = fixture
  const pkg = require(path.join(fixture, 'package.json'))

  await t.rejects(async () => {
    await lifecycle(pkg, 'signal-abrt', fixture, {
      stdio: 'pipe',
      log,
      dir,
      config: {}
    })
  })

  stubProcessExit.restore()
})

test('exit with error on INT signal from child', async function (t) {
  if (isWindows()) {
    // On Windows there is no way to get the INT signal
    return
  }
  const fixture = path.join(__dirname, 'fixtures', 'count-to-10')

  const verbose = sinon.spy()
  const silly = sinon.spy()
  const info = sinon.spy()

  const stubProcessExit = sinon.stub(process, 'kill').callsFake(noop)

  const log = {
    level: 'silent',
    info,
    warn: noop,
    silly,
    verbose,
    pause: noop,
    resume: noop,
    clearProgress: noop,
    showProgress: noop
  }

  const dir = fixture
  const pkg = require(path.join(fixture, 'package.json'))

  await t.rejects(async () => {
    await lifecycle(pkg, 'signal-int', fixture, {
      stdio: 'pipe',
      log,
      dir,
      config: {}
    })
  })

  stubProcessExit.restore()
  stubProcessExit.calledOnceWith(process.pid, 'SIGINT')

  t.ok(
    info.calledWithMatch(
      'lifecycle',
      'undefined~signal-int:',
      'Failed to exec signal-int script'
    ),
    'INT signal not intercepted'
  )

  t.ok(
    silly.calledWithMatch(
      'lifecycle',
      'undefined~signal-int:',
      'Returned: code:',
      null,
      ' signal:',
      'SIGINT'
    ),
    'INT signal reported'
  )
})
