const extendPath = require('../lib/extendPath');
const test = require('tap').test

test('the path to noge-gyp should be added after the path to node_modules/.bin', (t) => {
  const path = extendPath(process.cwd(), '', 'node_gyp', { extraBinPaths: [] })
  t.ok(path.indexOf('.bin') < path.indexOf('node_gyp'))
  t.end()
});
