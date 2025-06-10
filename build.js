const esbuild = require('esbuild')
const path = require('node:path')
const fs = require('node:fs')

const isWatch = process.argv.includes('--watch')
const isDev = isWatch || process.argv.includes('--dev')

function copyMDXEditorCSS() {
  try {
    const srcPath = path.join(
      'node_modules',
      '@mdxeditor',
      'editor',
      'dist',
      'style.css'
    )
    const destPath = path.join('bin', 'mdx-editor.css')

    // Ensure bin directory exists
    if (!fs.existsSync('bin')) {
      fs.mkdirSync('bin', { recursive: true })
    }

    fs.copyFileSync(srcPath, destPath)
    console.log('MDX Editor CSS copied to bin/mdx-editor.css')
  } catch (error) {
    console.warn('Could not copy MDX Editor CSS:', error.message)
  }
}

async function build() {
  // Extension build context
  const extensionCtx = await esbuild.context({
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: 'bin/main.js',
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
    entryPoints: ['src/webview/index.tsx'],
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

  // Copy MDX Editor CSS
  copyMDXEditorCSS()

  if (isWatch) {
    console.log('Watching for changes...')
    await Promise.all([extensionCtx.watch(), webviewCtx.watch()])
  } else {
    await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild()])
    await Promise.all([extensionCtx.dispose(), webviewCtx.dispose()])
    console.log('Build complete!')
  }
}

build().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
