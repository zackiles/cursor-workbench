#!/usr/bin/env node

/**
 * Complete local release script for VS Code extension
 * Builds, packages, and installs the extension locally
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const EXTENSION_NAME = 'cursor-workbench.cursor-workbench'
const PACKAGE_FILE = path.join('dist', 'cursor-workbench-0.0.1.vsix')

console.log('🚀 Starting local release process...\n')

// Helper function to check if a command exists
function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// Detect available editors
const editors = []
if (commandExists('code')) {
  editors.push({ name: 'VS Code', command: 'code' })
}
if (commandExists('cursor')) {
  editors.push({ name: 'Cursor', command: 'cursor' })
}

if (editors.length === 0) {
  console.log('❌ Neither VS Code nor Cursor found in PATH')
  console.log(
    'Please install VS Code or Cursor and make sure they are available in your PATH'
  )
  process.exit(1)
}

console.log(`📋 Found editors: ${editors.map((e) => e.name).join(', ')}\n`)

// Helper function to run commands with proper error handling
function runCommand(command, description, allowFail = false) {
  console.log(`📋 ${description}...`)
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    console.log(`✅ ${description} completed`)
    return output
  } catch (error) {
    if (allowFail) {
      console.log(`⚠️  ${description} failed (continuing anyway)`)
      return null
    }
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

  // Ensure dist directory exists
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true })
    console.log('📁 Created dist directory')
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

// Step 4: Process each editor
for (const editor of editors) {
  console.log(`\n🔍 Processing ${editor.name}...`)

  // Always attempt to uninstall first to ensure clean installation
  console.log(
    `🧹 Attempting to uninstall any existing installation in ${editor.name}...`
  )
  runCommand(
    `${editor.command} --uninstall-extension ${EXTENSION_NAME}`,
    `Uninstalling existing extension from ${editor.name} (if present)`,
    true
  )

  // Wait a moment for uninstall to complete
  console.log('⏳ Waiting for uninstall to complete...')
  execSync('sleep 2', { stdio: 'ignore' })

  // Install the new extension
  runCommand(
    `${editor.command} --install-extension ${PACKAGE_FILE}`,
    `Installing extension in ${editor.name}`
  )

  // Verify installation
  console.log(`🔍 Verifying installation in ${editor.name}...`)
  try {
    const installedExtensions = execSync(
      `${editor.command} --list-extensions`,
      {
        encoding: 'utf8'
      }
    )
    if (installedExtensions.includes(EXTENSION_NAME)) {
      console.log(
        `✅ Extension successfully installed and verified in ${editor.name}`
      )
    } else {
      console.log(
        `❌ Extension installation could not be verified in ${editor.name}`
      )
      console.log(`Please check ${editor.name} and try manual installation`)
    }
  } catch (error) {
    console.log(
      `⚠️  Could not verify installation in ${editor.name}:`,
      error.message
    )
  }
}

// Step 5: Show installation summary
console.log('\n📋 Installation Summary:')
console.log(`   Extension ID: ${EXTENSION_NAME}`)
console.log(`   Package File: ${PACKAGE_FILE}`)
console.log('   File Extensions: *.rule')
console.log(`   Installed in: ${editors.map((e) => e.name).join(', ')}`)

// Step 6: Provide next steps
console.log('\n🎉 Local release completed successfully!')
console.log('\n📝 Next Steps:')
console.log('1. Open or create a .rule file in VS Code or Cursor')
console.log('2. The custom editor should open automatically')
console.log('3. Test the front matter fields and content editing')
console.log('\n💡 Useful Commands:')
if (editors.find((e) => e.command === 'code')) {
  console.log(
    '   List extensions (VS Code): code --list-extensions | grep cursor-workbench'
  )
  console.log(
    `   Uninstall (VS Code): code --uninstall-extension ${EXTENSION_NAME}`
  )
}
if (editors.find((e) => e.command === 'cursor')) {
  console.log(
    '   List extensions (Cursor): cursor --list-extensions | grep cursor-workbench'
  )
  console.log(
    `   Uninstall (Cursor): cursor --uninstall-extension ${EXTENSION_NAME}`
  )
}
console.log('   Development: npm run dev (for watch mode)')

// Clean up: optionally remove the .vsix file
console.log('\n🗑️  Package file kept for distribution')
console.log(`   Location: ${path.resolve(PACKAGE_FILE)}`)
console.log('   You can share this file with others for installation')
