// Spawned as its own detached process group (see signal-group.js) so that
// sending a real, process-group-wide SIGINT here only reaches this driver,
// not whatever process tree launched it. The lifecycle child itself is
// spawned detached too (that's the fix under test), so this signal reaches
// only the driver directly; the child should see it exactly once, via the
// driver's explicit forward.
import { lifecycle } from '../../../index.js'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const fixture = import.meta.dirname
const pkg = require(path.join(fixture, 'package.json'))

function noop () {}

const verboseCalls = []
const log = {
  level: 'silent',
  info: noop,
  warn: noop,
  silly: noop,
  verbose: (...args) => { verboseCalls.push(args) },
  pause: noop,
  resume: noop,
  clearProgress: noop,
  showProgress: noop
}

const result = lifecycle(pkg, 'graceful', fixture, { stdio: 'pipe', log, dir: fixture, config: {} })
  .then(() => 'resolved')
  .catch(() => 'rejected')

const ready = new Promise((resolve) => {
  const timer = setInterval(() => {
    if (verboseCalls.some(call => typeof call[3] === 'string' && call[3].includes('ready'))) {
      clearInterval(timer)
      resolve()
    }
  }, 5)
})

ready.then(() => {
  // process group 0 means "this process's own group": a real analogue of a
  // terminal delivering Ctrl-C to every process in the foreground group.
  process.kill(0, 'SIGINT')
})

const outcome = await result
const cleanedUp = verboseCalls.some(call => typeof call[3] === 'string' && call[3].includes('cleanup finished'))
console.log(`RESULT outcome=${outcome} cleanedUp=${cleanedUp}`)
