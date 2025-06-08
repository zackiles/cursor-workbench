#!/usr/bin/env node

/**
 * Complete local release script for VS Code extension
 * Builds, packages, and installs the extension locally
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const EXTENSION_NAME = 'cursor-workbench.cursor-workbench'
const PACKAGE_FILE = 'cursor-workbench-0.0.1.vsix'

console.log('🚀 Starting local release process...\n')

// Helper function to run commands with proper error handling
function runCommand(command, description) {
  console.log(`📋 ${description}...`)
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    console.log(`✅ ${description} completed`)
    return output
  } catch (error) {
    console.log(`❌ ${description} failed:`)
    console.log(error.stdout || error.message)
    if (error.stderr) {
      console.log('Error details:', error.stderr)
    }
    process.exit(1)
  }
}

// Step 1: Clean previous builds
console.log('🧹 Cleaning previous builds...')
try {
  if (fs.existsSync('bin')) {
    fs.rmSync('bin', { recursive: true, force: true })
    console.log('✅ Cleaned bin directory')
  }

  if (fs.existsSync(PACKAGE_FILE)) {
    fs.unlinkSync(PACKAGE_FILE)
    console.log('✅ Cleaned previous package file')
  }
} catch (error) {
  console.log('⚠️  Warning during cleanup:', error.message)
}

// Step 2: Build the extension
runCommand('npm run build', 'Building extension')

// Step 3: Package the extension
runCommand('npm run package', 'Packaging extension')

// Verify package file was created
if (!fs.existsSync(PACKAGE_FILE)) {
  console.log(`❌ Package file ${PACKAGE_FILE} was not created`)
  process.exit(1)
}

console.log(`✅ Package created: ${PACKAGE_FILE}`)
const stats = fs.statSync(PACKAGE_FILE)
console.log(`📦 Package size: ${(stats.size / 1024).toFixed(1)} KB`)

// Step 4: Check if extension is currently installed
console.log('\n🔍 Checking for existing installation...')
try {
  const installedExtensions = execSync('code --list-extensions', {
    encoding: 'utf8'
  })
  if (installedExtensions.includes(EXTENSION_NAME)) {
    console.log('📦 Found existing installation, uninstalling...')
    runCommand(
      `code --uninstall-extension ${EXTENSION_NAME}`,
      'Uninstalling existing extension'
    )

    // Wait a moment for uninstall to complete
    console.log('⏳ Waiting for uninstall to complete...')
    // Using child_process to create a synchronous delay
    execSync('sleep 2', { stdio: 'ignore' })
  } else {
    console.log('✅ No existing installation found')
  }
} catch (error) {
  console.log('⚠️  Could not check existing installations:', error.message)
}

// Step 5: Install the new extension
runCommand(`code --install-extension ${PACKAGE_FILE}`, 'Installing extension')

// Step 6: Verify installation
console.log('\n🔍 Verifying installation...')
try {
  const installedExtensions = execSync('code --list-extensions', {
    encoding: 'utf8'
  })
  if (installedExtensions.includes(EXTENSION_NAME)) {
    console.log('✅ Extension successfully installed and verified')

    // Show extension details
    console.log('\n📋 Installation Details:')
    console.log(`   Extension ID: ${EXTENSION_NAME}`)
    console.log(`   Package File: ${PACKAGE_FILE}`)
    console.log('   File Extensions: *.rule')
  } else {
    console.log('❌ Extension installation could not be verified')
    console.log('Please check VS Code and try manual installation')
    process.exit(1)
  }
} catch (error) {
  console.log('⚠️  Could not verify installation:', error.message)
}

// Step 7: Provide next steps
console.log('\n🎉 Local release completed successfully!')
console.log('\n📝 Next Steps:')
console.log('1. Open or create a .rule file in VS Code')
console.log('2. The custom editor should open automatically')
console.log('3. Test the front matter fields and content editing')
console.log('\n💡 Useful Commands:')
console.log(
  '   List extensions: code --list-extensions | grep cursor-workbench'
)
console.log(`   Uninstall: code --uninstall-extension ${EXTENSION_NAME}`)
console.log('   Development: npm run dev (for watch mode)')

// Clean up: optionally remove the .vsix file
console.log('\n🗑️  Package file kept for distribution')
console.log(`   Location: ${path.resolve(PACKAGE_FILE)}`)
console.log('   You can share this file with others for installation')
