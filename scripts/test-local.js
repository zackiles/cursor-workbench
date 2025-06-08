#!/usr/bin/env node

/**
 * Simple local test script to verify basic functionality
 * This can be run without VS Code to test core logic
 */

const fs = require('node:fs')
const path = require('node:path')

console.log('🧪 Running local tests for Custom File Editor...\n')

// Test 1: Verify build output exists
console.log('1. Checking build output...')
const buildPath = path.join(__dirname, '..', 'bin', 'main.js')
if (fs.existsSync(buildPath)) {
  console.log('✅ Build output exists at bin/main.js')
} else {
  console.log('❌ Build output missing. Run "npm run build" first.')
  process.exit(1)
}

// Test 2: Verify package.json configuration
console.log('\n2. Checking package.json configuration...')
const packagePath = path.join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

if (packageJson.contributes?.customEditors) {
  const customEditor = packageJson.contributes.customEditors[0]
  if (customEditor.viewType === 'customFileEditor') {
    console.log('✅ Custom editor configuration is correct')
    console.log(`   - View Type: ${customEditor.viewType}`)
    console.log(`   - Display Name: ${customEditor.displayName}`)
    console.log(
      `   - File Pattern: ${customEditor.selector[0].filenamePattern}`
    )
  } else {
    console.log('❌ Custom editor view type mismatch')
  }
} else {
  console.log('❌ Custom editor configuration missing')
}

// Test 3: Test sample .rule file parsing (basic regex test)
console.log('\n3. Testing front matter parsing...')
const testFilePath = path.join(__dirname, '..', 'test.rule')
if (fs.existsSync(testFilePath)) {
  const content = fs.readFileSync(testFilePath, 'utf8')
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
  const match = content.match(frontMatterRegex)

  if (match) {
    const frontMatter = match[1]
    const mainContent = match[2]

    const ruleMatch = frontMatter.match(/rule:\s*(.+)/)
    const globsMatch = frontMatter.match(/globs:\s*(.+)/)

    console.log('✅ Front matter parsing works')
    console.log(`   - Rule: ${ruleMatch ? ruleMatch[1].trim() : 'not found'}`)
    console.log(
      `   - Globs: ${globsMatch ? globsMatch[1].trim() : 'not found'}`
    )
    console.log(`   - Content length: ${mainContent.trim().length} characters`)
  } else {
    console.log('❌ Front matter parsing failed')
  }
} else {
  console.log('⚠️  test.rule file not found, skipping parsing test')
}

// Test 4: Verify VS Code configuration files
console.log('\n4. Checking VS Code configuration...')
const launchJsonPath = path.join(__dirname, '..', '.vscode', 'launch.json')
const tasksJsonPath = path.join(__dirname, '..', '.vscode', 'tasks.json')

if (fs.existsSync(launchJsonPath)) {
  console.log('✅ launch.json exists for debugging')
} else {
  console.log('❌ launch.json missing')
}

if (fs.existsSync(tasksJsonPath)) {
  console.log('✅ tasks.json exists for build tasks')
} else {
  console.log('❌ tasks.json missing')
}

console.log('\n🎉 Local tests completed!')
console.log('\nTo test the extension in VS Code:')
console.log('1. Open this project in VS Code')
console.log('2. Press F5 to launch Extension Development Host')
console.log('3. Create or open a .rule file in the new window')
console.log('4. The custom editor should open automatically')
