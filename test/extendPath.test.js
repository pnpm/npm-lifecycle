import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extendPath } from '../lib/extendPath.js'

test('the path to node-gyp should be added after the path to node_modules/.bin', () => {
  const p = extendPath(process.cwd(), '', 'node_gyp', { extraBinPaths: [] })
  assert.ok(p.indexOf('.bin') < p.indexOf('node_gyp'))
})
