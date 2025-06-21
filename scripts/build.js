const esbuild = require('esbuild')
const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

// Parse arguments
const isDev = process.argv.includes('--dev')
const isWatch = process.argv.includes('--watch')
const isProduction = process.argv.includes('--production')

// Build timestamp
const buildTime = new Date().toISOString()

console.log(
  `🔨 Building ${isDev || isWatch ? 'development' : 'production'} build...`
)

async function build() {
  // Clean bin directory
  if (!isWatch && fs.existsSync('bin')) {
    fs.rmSync('bin', { recursive: true, force: true })
  }
  fs.mkdirSync('bin', { recursive: true })

  // Common build options
  const commonOptions = {
    bundle: true,
    platform: 'node',
    target: 'node16',
    external: ['vscode'],
    sourcemap: isDev || isWatch ? 'inline' : false,
    minify: isProduction && !isDev && !isWatch,
    define: {
      'process.env.NODE_ENV':
        isDev || isWatch ? '"development"' : '"production"',
      'process.env.BUILD_TIME': `"${buildTime}"`
    },
    logLevel: 'info'
  }

  // Extension build
  const extensionCtx = await esbuild.context({
    ...commonOptions,
    entryPoints: ['src/extension.ts'],
    outfile: 'bin/extension.js',
    format: 'cjs'
  })

  // Webview build
  const webviewCtx = await esbuild.context({
    ...commonOptions,
    entryPoints: ['src/webviews/main.tsx'],
    outfile: 'bin/webview.js',
    platform: 'browser',
    target: 'es2020',
    format: 'iife',
    jsx: 'automatic',
    jsxImportSource: 'react',
    external: [] // No externals for webview
  })

  // CSS build
  const cssCtx = await esbuild.context({
    entryPoints: ['src/webviews/styles/index.css'],
    outfile: 'bin/webview.css',
    bundle: true,
    minify: isProduction && !isDev && !isWatch,
    loader: { '.css': 'css' }
  })

  if (isWatch) {
    console.log('👀 Watching for changes...')
    await Promise.all([
      extensionCtx.watch(),
      webviewCtx.watch(),
      cssCtx.watch()
    ])

    process.stdin.resume()
  } else {
    // Build once
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

    if (isProduction) {
      console.log('📦 Creating VSIX package...')

      // Ensure dist directory exists
      if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist', { recursive: true })
      }

      try {
        execSync('npx vsce package --out dist/cursor-workbench-0.0.1.vsix', {
          stdio: 'inherit'
        })
        console.log('✅ Package created: dist/cursor-workbench-0.0.1.vsix')
      } catch (error) {
        console.error('❌ Failed to create package:', error.message)
        process.exit(1)
      }
    }

    console.log('✅ Build complete!')
  }
}

build().catch((error) => {
  console.error('❌ Build failed:', error)
  process.exit(1)
})
