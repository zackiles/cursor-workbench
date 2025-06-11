const esbuild = require('esbuild')
const path = require('node:path')
const fs = require('node:fs')
const { exec } = require('node:child_process')

const isWatch = process.argv.includes('--watch')
const isDev = isWatch || process.argv.includes('--dev')
const autoReload = process.argv.includes('--auto-reload')

// Helper to reload VS Code Extension Host
function reloadExtensionHost() {
  console.log('🔄 Triggering VS Code window reload...')

  // For macOS and Linux
  if (process.platform === 'darwin' || process.platform === 'linux') {
    exec(
      'osascript -e \'tell application "Visual Studio Code" to activate\' -e \'tell application "System Events" to keystroke "r" using {command down, shift down}\'',
      (error) => {
        if (error && error.code !== 0) {
          console.log(
            'Could not reload using AppleScript, falling back to command...'
          )
          exec('code --command "workbench.action.reloadWindow"')
        }
      }
    )
  }
  // For Windows
  else if (process.platform === 'win32') {
    exec(
      "powershell -command \"& {$wshell = New-Object -ComObject wscript.shell; $wshell.AppActivate('Visual Studio Code'); Start-Sleep -Milliseconds 100; $wshell.SendKeys('^+{r}')}\"",
      (error) => {
        if (error && error.code !== 0) {
          console.log(
            'Could not reload using PowerShell, falling back to command...'
          )
          exec('code --command "workbench.action.reloadWindow"')
        }
      }
    )
  }
  // Fallback for other platforms
  else {
    exec('code --command "workbench.action.reloadWindow"')
  }
}

async function build() {
  // Ensure bin directory exists
  if (!fs.existsSync('bin')) {
    fs.mkdirSync('bin', { recursive: true })
  }

  // Extension build context
  const extensionCtx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'bin/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    sourcemap: isDev,
    minify: !isDev,
    target: 'node16',
    treeShaking: true,
    metafile: true,
    define: {
      'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
    },
    logLevel: 'info',
    // VS Code extension optimizations
    mainFields: ['module', 'main'],
    conditions: ['import', 'require']
  })

  // Webview build context for React components
  const webviewCtx = await esbuild.context({
    entryPoints: ['src/webviews/main.tsx'],
    bundle: true,
    outfile: 'bin/webview.js',
    format: 'iife',
    platform: 'browser',
    sourcemap: isDev,
    minify: !isDev,
    target: 'es2020',
    treeShaking: true,
    metafile: true,
    jsx: 'automatic',
    jsxImportSource: 'react',
    define: {
      'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
    },
    logLevel: 'info'
  })

  // CSS build context - using a single entry point that imports others
  const cssCtx = await esbuild.context({
    entryPoints: ['src/webviews/rule-editor/RuleEditor.css'],
    bundle: true,
    outfile: 'bin/webview.css',
    minify: !isDev,
    loader: {
      '.css': 'css'
    },
    logLevel: 'info'
  })

  if (isWatch) {
    console.log('Watching for changes...')

    // Add reload on rebuild functionality if auto-reload is enabled
    if (autoReload) {
      // Set up a debounced reload function to avoid multiple rapid reloads
      let reloadTimeout = null
      const debouncedReload = () => {
        clearTimeout(reloadTimeout)
        reloadTimeout = setTimeout(() => {
          reloadExtensionHost()
        }, 1000) // Wait 1 second after last rebuild before reloading
      }

      // Add rebuild listeners
      extensionCtx.onEnd(debouncedReload)
      webviewCtx.onEnd(debouncedReload)
      cssCtx.onEnd(debouncedReload)

      console.log(
        'Auto-reload enabled. VS Code will reload automatically on changes.'
      )
    }

    await Promise.all([
      extensionCtx.watch(),
      webviewCtx.watch(),
      cssCtx.watch()
    ])
  } else {
    await Promise.all([
      extensionCtx.rebuild(),
      webviewCtx.rebuild(),
      cssCtx.rebuild()
    ])
    await Promise.all([
      extensionCtx.dispose(),
      webviewCtx.dispose(),
      cssCtx.dispose()
    ])
    console.log('Build complete!')
  }
}

build().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
