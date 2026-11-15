const path = require('path')
const esbuild = require(path.join(__dirname, '..', '..', 'web', 'node_modules', 'esbuild'))
esbuild.build({
  entryPoints: [path.join(__dirname, 'frontend', 'plugin.js')],
  outfile: path.join(__dirname, 'assets', 'plugin.js'),
  bundle: true, format: 'iife', target: 'es2020', minify: true, legalComments: 'none',
}).then(() => console.log('aidraw frontend built')).catch((e) => { console.error(e); process.exit(1) })
