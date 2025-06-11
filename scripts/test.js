const fs = require('node:fs')
const path = require('node:path')

console.log('🧪 Running tests...\n')

let failed = false

function test(description, condition) {
  if (condition) {
    console.log(`✅ ${description}`)
  } else {
    console.log(`❌ ${description}`)
    failed = true
  }
}

// Test 1: Development build exists
test(
  'Development build exists',
  fs.existsSync('bin/extension.js') &&
    fs.existsSync('bin/webview.js') &&
    fs.existsSync('bin/webview.css')
)

// Test 2: Package.json configuration
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
test(
  'Package.json has correct main entry',
  packageJson.main === './bin/extension.js'
)
test(
  'Package.json has custom editor config',
  packageJson.contributes?.customEditors?.length > 0
)

// Test 3: Sample rule file parsing
if (fs.existsSync('test.rule')) {
  const content = fs.readFileSync('test.rule', 'utf8')
  const hasFrontMatter = /^---\s*\n([\s\S]*?)\n---/.test(content)
  test('Sample rule file has valid front matter', hasFrontMatter)
}

console.log(failed ? '\n❌ Tests failed' : '\n✅ All tests passed')
process.exit(failed ? 1 : 0)
