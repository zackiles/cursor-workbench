# Releasing & Local Installation Guide

This guide explains how to build, package, and install the Custom File Editor extension locally on your desktop VS Code installation without using the official marketplace.

## Prerequisites

- VS Code installed on your system
- Node.js and npm installed
- Extension dependencies installed: `npm install`
- VS Code Extension Manager (`vsce`) installed globally: `npm install -g vsce`

## Building the Extension

### 1. Build the Extension

```bash
npm run build
```

This compiles the TypeScript source code to JavaScript in the `bin/` directory.

### 2. Package the Extension

```bash
npm run package
```

Or directly using vsce:

```bash
vsce package
```

This creates a `.vsix` file (e.g., `cursor-workbench-0.0.1.vsix`) that contains the packaged extension.

## Installing Locally

### Method 1: Command Line Installation (Recommended)

```bash
# Install the packaged extension
code --install-extension cursor-workbench-0.0.1.vsix

# Verify installation
code --list-extensions | grep cursor-workbench
```

### Method 2: VS Code UI Installation

1. Open VS Code
2. Go to Extensions view (`Ctrl/Cmd+Shift+X`)
3. Click the "..." menu (Views and More Actions)
4. Select "Install from VSIX..."
5. Browse and select your `.vsix` file
6. Restart VS Code if prompted

### Method 3: Automated Installation Script

Use the provided script for one-command build and install:

```bash
npm run install:local
```

## Managing the Local Extension

### Check if Extension is Installed

```bash
code --list-extensions | grep cursor-workbench
```

### Uninstall the Extension

```bash
# Using npm script
npm run uninstall-extension

# Or directly
code --uninstall-extension cursor-workbench.cursor-workbench
```

### Update/Reinstall

To update to a newer version:

```bash
# Build and package new version
npm run build
npm run package

# Uninstall old version
npm run uninstall-extension

# Install new version
npm run install:local
```

## Quick Installation Scripts

### Full Build and Install

```bash
npm run release:local
```

This script will:
1. Clean previous builds
2. Build the extension
3. Package it into .vsix
4. Uninstall any existing version
5. Install the new version
6. List installed extensions to verify

### Development Installation

For rapid testing during development:

```bash
npm run dev:install
```

This does a quick build and install without cleaning.

## Verification

After installation, verify the extension works:

1. **Create a test file**: `touch test-file.rule`
2. **Open in VS Code**: `code test-file.rule`
3. **Verify custom editor**: The custom editor should open automatically
4. **Test functionality**:
   - Add YAML front matter
   - Edit the rule and globs fields
   - Add content in the text area
   - Save and reload to verify persistence

## Troubleshooting

### Extension Not Loading

```bash
# Check if extension is installed
code --list-extensions

# Check VS Code version compatibility
code --version

# Try reinstalling
npm run uninstall-extension
npm run install:local
```

### Custom Editor Not Opening

1. Check file extension is `.rule` (or whatever you configured)
2. Verify the extension is active in Extensions view
3. Try manually opening with: Right-click file → "Open With..." → "Custom File Editor"

### Build Issues

```bash
# Clean and rebuild
rm -rf bin/
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

### Package Issues

```bash
# Verify vsce is installed
vsce --version

# If not installed
npm install -g vsce

# Try packaging with verbose output
vsce package --verbose
```

## Distribution

To distribute the extension to others without marketplace:

1. **Build and package**: `npm run package`
2. **Share the .vsix file**: Send the generated `.vsix` file
3. **Installation instructions**: Recipients can install using:
   ```bash
   code --install-extension cursor-workbench-0.0.1.vsix
   ```

## Version Management

### Updating Version

1. Update version in `package.json`:
   ```json
   {
     "version": "0.0.2"
   }
   ```

2. Build and package:
   ```bash
   npm run build
   npm run package
   ```

### Release Notes

When distributing, include:
- What file extensions are supported (currently `.rule`)
- Basic usage instructions
- Any configuration requirements
- Changelog if updating existing installation

## Automation Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run build` | Build TypeScript to JavaScript |
| `npm run package` | Create .vsix package file |
| `npm run verify:package` | Test build and package creation (no install) |
| `npm run install:local` | Install packaged extension locally |
| `npm run uninstall-extension` | Remove extension from VS Code |
| `npm run release:local` | Full build, package, and install process |
| `npm run dev:install` | Quick development install |
| `npm run test:local` | Validate extension configuration |

## Package Size & Optimization

The extension package is highly optimized at **~10KB with only 14 files**:

- ✅ **Proper bundling**: Uses esbuild with tree-shaking and minification
- ✅ **Comprehensive exclusions**: `.vscodeignore` excludes all unnecessary files
- ✅ **No bloat**: Zero unused dependencies included
- ✅ **VS Code best practices**: Follows official optimization guidelines

To verify optimization:
```bash
npm run verify:package
```

See [docs/OPTIMIZATION.md](./docs/OPTIMIZATION.md) for detailed optimization information.

## Security Note

When installing extensions from `.vsix` files (not from marketplace), VS Code will show a warning. This is normal for locally packaged extensions. Click "Install" to proceed.
