const esbuild = require('esbuild')
const path = require('node:path')

const isWatch = process.argv.includes('--watch')
const isDev = isWatch || process.argv.includes('--dev')

async function build() {
  const ctx = await esbuild.context({
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

  if (isWatch) {
    console.log('Watching for changes...')
    await ctx.watch()
  } else {
    await ctx.rebuild()
    await ctx.dispose()
    console.log('Build complete!')
  }
}

build().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
