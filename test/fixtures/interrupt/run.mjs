// Runs the fixture's dev script through lifecycle() with inherited stdio, as
// `pnpm run` does.
import path from 'path'
import { lifecycle } from '../../../index.js'

const fixture = import.meta.dirname
const pkg = JSON.parse(await import('fs').then(fs => fs.promises.readFile(path.join(fixture, 'package.json'), 'utf8')))
const noop = () => {}
const log = { level: 'silent', info: noop, warn: noop, silly: noop, verbose: noop, pause: noop, resume: noop, clearProgress: noop, showProgress: noop }
try {
  await lifecycle(pkg, 'dev', fixture, { stdio: 'inherit', log, dir: fixture, config: {} })
} catch (err) {
  console.log(`lifecycle failed: ${err.message}`)
  process.exit(1)
}
