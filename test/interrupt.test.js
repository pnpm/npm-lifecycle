import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'child_process'
import path from 'path'

const fixture = path.join(import.meta.dirname, 'fixtures', 'interrupt')
const runScript = path.join(fixture, 'run.mjs')
const noSignals = process.platform === 'win32' && 'no SIGINT on Windows'
const shutdownTimeout = 10_000

test('Ctrl+C in a terminal interrupts the child once', { skip: noSignals }, () => {
  const { stdout, status, error } = spawnSync('python3', [path.join(fixture, 'terminal.py'), process.execPath, runScript], { encoding: 'utf8', timeout: shutdownTimeout })
  assert.ifError(error)
  assert.doesNotMatch(stdout, /forced/, `the child saw a second SIGINT:\n${stdout}`)
  assert.match(stdout, /shut down/, `the child did not finish shutting down:\n${stdout}`)
  assert.equal(status, 0, `the run did not exit 0:\n${stdout}`)
})

test('a SIGINT sent to a process without a terminal is relayed to the child', { skip: noSignals }, async () => {
  const proc = spawn(process.execPath, [runScript], { detached: true, stdio: ['ignore', 'pipe', 'inherit'] })
  let stdout = ''
  proc.stdout.setEncoding('utf8')
  const exited = new Promise((resolve) => { proc.on('close', resolve) })
  const killTimer = setTimeout(() => { proc.kill('SIGKILL') }, shutdownTimeout)
  const started = new Promise((resolve) => {
    proc.stdout.on('data', (data) => {
      stdout += data
      if (stdout.includes('started')) resolve()
    })
  })
  await Promise.race([started, exited])
  proc.kill('SIGINT')
  const code = await exited
  clearTimeout(killTimer)
  assert.doesNotMatch(stdout, /forced/, `the child saw a second SIGINT:\n${stdout}`)
  assert.match(stdout, /shut down/, `the child was not interrupted:\n${stdout}`)
  assert.equal(code, 0, `the run did not exit 0:\n${stdout}`)
})
