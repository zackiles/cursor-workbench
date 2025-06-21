const fs = require('node:fs')
const path = require('node:path')
const { spawn, execSync } = require('node:child_process')
const os = require('node:os')

const PROJECT_DIR = process.cwd()
const TEMP_DIR = path.join(os.tmpdir(), `cursor-workbench-dev-${Date.now()}`)
let vscodeProcess = null
let buildProcess = null

console.log('🚀 Starting Cursor Workbench development environment...')
console.log(`📁 Project directory: ${PROJECT_DIR}`)
console.log(`📁 Temp directory: ${TEMP_DIR}`)

// Cleanup function
function cleanup() {
  console.log('\n🧹 Cleaning up...')

  if (vscodeProcess) {
    console.log('  Terminating VS Code process...')
    try {
      if (process.platform === 'darwin') {
        // On macOS, need to kill VS Code differently since 'open' command exits immediately
        execSync("pkill -f 'Visual Studio Code.*--extensionDevelopmentPath'", {
          stdio: 'ignore'
        })
        console.log('  ✅ VS Code processes terminated')
      } else {
        vscodeProcess.kill('SIGTERM')
      }
    } catch (error) {
      console.log('  VS Code process already terminated or not found')
    }
    vscodeProcess = null
  }

  if (buildProcess) {
    console.log('  Terminating build process...')
    try {
      buildProcess.kill('SIGTERM')
    } catch (error) {
      console.log('  Build process already terminated')
    }
  }

  if (fs.existsSync(TEMP_DIR)) {
    console.log('  Removing temp directory...')
    try {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true })
      console.log('  ✅ Temp directory removed')
    } catch (error) {
      console.log('  ❌ Failed to remove temp directory:', error.message)
    }
  }

  console.log('🏁 Cleanup complete')
  process.exit(0)
}

// Handle process termination
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
process.on('exit', cleanup)

// Copy project files to temp directory (excluding certain directories)
function copyProjectFiles() {
  console.log('📋 Copying project files to temp directory...')

  const excludeDirs = ['node_modules', '.git', 'bin', 'dist', '.vscode']
  const excludeFiles = ['.DS_Store', '*.log']

  try {
    // Create temp directory
    fs.mkdirSync(TEMP_DIR, { recursive: true })

    // Recursively copy files
    function copyRecursively(src, dest) {
      const stat = fs.statSync(src)

      if (stat.isDirectory()) {
        const dirName = path.basename(src)

        // Skip excluded directories
        if (excludeDirs.includes(dirName)) {
          return
        }

        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true })
        }

        const entries = fs.readdirSync(src)
        for (const entry of entries) {
          const srcPath = path.join(src, entry)
          const destPath = path.join(dest, entry)
          copyRecursively(srcPath, destPath)
        }
      } else {
        const fileName = path.basename(src)

        // Skip excluded files
        if (
          excludeFiles.some((pattern) => {
            if (pattern.includes('*')) {
              const regex = new RegExp(pattern.replace('*', '.*'))
              return regex.test(fileName)
            }
            return fileName === pattern
          })
        ) {
          return
        }

        fs.copyFileSync(src, dest)
      }
    }

    // Copy all files from project directory
    const entries = fs.readdirSync(PROJECT_DIR)
    for (const entry of entries) {
      const srcPath = path.join(PROJECT_DIR, entry)
      const destPath = path.join(TEMP_DIR, entry)
      copyRecursively(srcPath, destPath)
    }

    console.log('  ✅ Project files copied successfully')
  } catch (error) {
    console.error('  ❌ Failed to copy project files:', error.message)
    process.exit(1)
  }
}

// Start the build process with watch mode
function startBuildProcess() {
  console.log('🔨 Starting build process with watch mode...')

  const buildArgs = ['scripts/build.js', '--dev', '--watch']

  // Set environment variables for build process
  const env = {
    ...process.env,
    PROJECT_SOURCE_DIR: PROJECT_DIR,
    PROJECT_TARGET_DIR: TEMP_DIR
  }

  buildProcess = spawn('node', buildArgs, {
    cwd: PROJECT_DIR,
    env: env,
    stdio: 'inherit'
  })

  buildProcess.on('error', (error) => {
    console.error('❌ Build process error:', error.message)
    cleanup()
  })

  buildProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ Build process exited with code ${code}`)
      console.log('💡 You may need to restart the dev environment')
    }
    buildProcess = null // Clear reference
  })
}

// Launch VS Code with the temp directory
function launchVSCode() {
  console.log('🖥️  Launching VS Code...')

  // Set environment variables for VS Code
  const env = {
    ...process.env,
    PROJECT_SOURCE_DIR: PROJECT_DIR
  }

  if (process.platform === 'darwin') {
    // Use 'open' command on macOS like the original script
    const openArgs = [
      '-a',
      'Visual Studio Code',
      '--args',
      '--disable-extensions',
      '--enable-proposed-api',
      '--disable-workspace-trust',
      `--extensionDevelopmentPath=${TEMP_DIR}`,
      TEMP_DIR
    ]

    console.log('  🔧 VS Code command:', 'open', openArgs.join(' '))

    vscodeProcess = spawn('open', openArgs, {
      env: env,
      stdio: 'pipe'
    })

    console.log('  ✅ VS Code launch command executed')
  } else {
    // Use 'code' command on other platforms
    const vscodeArgs = [
      '--disable-extensions',
      '--enable-proposed-api',
      '--disable-workspace-trust',
      `--extensionDevelopmentPath=${TEMP_DIR}`,
      TEMP_DIR
    ]

    console.log('  🔧 VS Code command:', 'code', vscodeArgs.join(' '))

    vscodeProcess = spawn('code', vscodeArgs, {
      env: env,
      stdio: 'pipe'
    })

    console.log('  ✅ VS Code launch command executed')
  }

  vscodeProcess.on('error', (error) => {
    console.error('❌ Failed to launch VS Code:', error.message)
    console.log('💡 Make sure VS Code is installed and available in PATH')
  })

  vscodeProcess.on('exit', (code) => {
    console.log(`🖥️  VS Code launcher process exited with code ${code}`)
    // Note: On macOS, this is just the 'open' command exiting, not VS Code itself
    // VS Code continues running and will be terminated by cleanup function
  })
}

// Wait for initial build to complete
function waitForInitialBuild() {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const binPath = path.join(TEMP_DIR, 'bin', 'extension.js')
      if (fs.existsSync(binPath)) {
        clearInterval(checkInterval)
        console.log('  ✅ Initial build completed')
        resolve()
      }
    }, 500)
  })
}

// Main execution
async function main() {
  try {
    // Step 1: Copy project files
    copyProjectFiles()

    // Step 2: Start build process
    startBuildProcess()

    // Step 3: Wait for initial build
    console.log('⏳ Waiting for initial build to complete...')
    await waitForInitialBuild()

    // Step 4: Launch VS Code
    launchVSCode()

    console.log('✅ Development environment ready!')
    console.log(
      '💡 File changes in the source directory will trigger rebuilds and reloads'
    )
    console.log('🛑 Press Ctrl+C to stop the development environment')

    // Keep the script running - don't exit
    // The build process is already running in watch mode
    // Just keep the main process alive
    process.stdin.resume()
  } catch (error) {
    console.error('❌ Failed to start development environment:', error.message)
    cleanup()
  }
}

main()
