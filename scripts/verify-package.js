#!/usr/bin/env node

/**
 * Package verification script
 * Tests building and packaging without installing
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')

const PACKAGE_FILE = 'cursor-workbench-0.0.1.vsix'

console.log('📋 Verifying package creation...\n')

// Clean previous package
if (fs.existsSync(PACKAGE_FILE)) {
  fs.unlinkSync(PACKAGE_FILE)
  console.log('🧹 Cleaned previous package')
}

try {
  // Build
  console.log('🔨 Building extension...')
  execSync('npm run build', { stdio: 'inherit' })

  // Package
  console.log('📦 Packaging extension...')
  execSync('npm run package', { stdio: 'inherit' })

  // Verify package exists
  if (fs.existsSync(PACKAGE_FILE)) {
    const stats = fs.statSync(PACKAGE_FILE)
    console.log('✅ Package verification successful!')
    console.log(`   File: ${PACKAGE_FILE}`)
    console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`)
    console.log('\n💡 Ready for installation or distribution')
  } else {
    console.log('❌ Package file was not created')
    process.exit(1)
  }
} catch (error) {
  console.log('❌ Package verification failed:')
  console.log(error.message)
  process.exit(1)
}
