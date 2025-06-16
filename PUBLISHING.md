# Publishing Guide

This document explains how the Cursor Workbench extension is published to the Open VSX Registry.

## Overview

The extension is automatically published to the [Open VSX Registry](https://open-vsx.org) when version tags are created on the main branch. This registry is the primary source for extensions used by Cursor IDE and other VS Code-compatible editors.

## Publishing Workflows

### 1. Test Workflow (`.github/workflows/test.yml`)
- Runs on every push and pull request
- Builds the extension and verifies package creation
- Must pass before release workflows can run

### 2. Release Workflow (`.github/workflows/release.yml`)
- Runs after Test workflow succeeds on version tags (e.g., `v1.0.0`)
- Creates GitHub releases with `.vsix` files as assets
- Generates release notes

### 3. Open VSX Publishing Workflow (`.github/workflows/release-ovsx.yml`)
- Runs after Release workflow succeeds
- Downloads the `.vsix` file from GitHub releases
- Publishes to Open VSX Registry under namespace `zackiles`

## Release Process

### Automatic Release (Recommended)

1. **Update Version**
   ```bash
   # Update version in package.json
   npm version patch  # or minor/major
   ```

2. **Create and Push Tag**
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

3. **Monitor Workflows**
   - Check GitHub Actions for successful completion
   - Verify extension appears on [Open VSX Registry](https://open-vsx.org/extension/zackiles/cursor-workbench)

### Manual Publishing (Development/Testing)

For testing purposes, you can publish manually:

```bash
# Set environment variable
export OPEN_VSX_TOKEN="your-token-here"

# Build and publish
npm run build
npm run release:ovsx
```

## Configuration

### GitHub Secrets

The following secret must be configured in the GitHub repository:

- `OPEN_VSX_TOKEN` - Personal access token for Open VSX Registry

### Package Configuration

Key settings in `package.json`:

```json
{
  "name": "@zackiles/cursor-workbench",
  "publisher": "zackiles",
  "version": "0.0.1"
}
```

### Open VSX Registry Details

- **Namespace**: `zackiles`
- **Extension Name**: `cursor-workbench`
- **Registry URL**: `https://open-vsx.org`
- **Extension URL**: `https://open-vsx.org/extension/zackiles/cursor-workbench`

## Installation for Users

Users can install the extension via:

1. **Cursor IDE Extensions Panel**
   - Search for "Cursor Workbench" or "@zackiles/cursor-workbench"

2. **Command Line**
   ```bash
   cursor --install-extension zackiles.cursor-workbench
   ```

3. **VS Code (if compatible)**
   ```bash
   code --install-extension zackiles.cursor-workbench
   ```

## Troubleshooting

### Common Issues

1. **Publishing Fails**
   - Verify `OPEN_VSX_TOKEN` secret is set correctly
   - Check that namespace `zackiles` exists on Open VSX
   - Ensure version number hasn't been published before

2. **Extension Not Found**
   - Allow time for registry indexing (usually a few minutes)
   - Verify correct namespace and extension name

3. **Version Conflicts**
   - Each version can only be published once
   - Use `npm version` to properly increment version numbers

### Logs and Debugging

- Check GitHub Actions logs for detailed error messages
- Use `npm run release:ovsx` locally to test publishing
- Verify `.vsix` file integrity before publishing

## Dependencies

The publishing process uses:

- [HaaLeo/publish-vscode-extension](https://github.com/HaaLeo/publish-vscode-extension) GitHub Action
- [ovsx CLI](https://www.npmjs.com/package/ovsx) for manual publishing
- [vsce](https://www.npmjs.com/package/vsce) for package creation

## Next Steps

After successful publishing:

1. Update documentation with new version information
2. Notify team members of the new release
3. Monitor for user feedback and issues
4. Plan next development cycle
