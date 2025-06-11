# Cursor Workbench - VS Code Extension

A VS Code extension for editing files with YAML front matter and content. Provides a custom editor, file explorer view, and settings management. Designed to support rule files and other structured content.

## Features

- 🎨 **Custom Editor Interface** - Clean, form-based editor with VS Code theming
- 📝 **YAML Front Matter Support** - Parse and edit structured metadata
- 🔧 **Configurable File Extensions** - Easy to adapt for different file types
- 💾 **Real-time Saving** - Changes are saved automatically as you type
- 🎯 **Simple UI** - Three-field interface: rule name, file patterns, and content
- 🌗 **VS Code Integration** - Inherits your VS Code theme and styling

## Installation

### From GitHub Releases (Recommended)

1. **Download the Extension**
   - Go to the [Releases page](../../releases)
   - Download the latest `.vsix` file (e.g., `cursor-workbench-0.0.1.vsix`)

2. **Install via Command Line**
   ```bash
   code --install-extension cursor-workbench-0.0.1.vsix
   ```

3. **Or Install via VS Code UI**
   - Open VS Code
   - Go to Extensions (`Ctrl/Cmd+Shift+X`)
   - Click the "..." menu (Views and More Actions)
   - Select "Install from VSIX..."
   - Choose the downloaded `.vsix` file

### Verify Installation

After installation, you can verify the extension is active:
```bash
code --list-extensions | grep cursor-workbench
```

## Usage

1. **Create or open a `.rule` file** in VS Code
2. **The custom editor opens automatically** for supported file types
3. **Edit your content**:
   - **Rule**: Enter a rule name or identifier
   - **Globs**: Specify file patterns (e.g., `*.ts,*.js`)
   - **Content**: Add your markdown or text content
4. **Save normally** (`Ctrl/Cmd+S`) - changes persist automatically

### Example File Structure

```yaml
---
rule: example-rule
globs: "*.ts,*.js"
---

# Example Content

This is the main content area where you can write markdown, documentation, or any text content.

## Features
- Supports any text content
- Markdown rendering in VS Code preview
- Structured front matter for metadata
```

## Supported File Extensions

Currently configured for:
- `.rule` files

*This can be easily changed - see [Configuration](#configuration) below.*

## Configuration

To use this extension with different file extensions:

1. **For Developers**: See [EXTENSION_CONFIG.md](./EXTENSION_CONFIG.md) for detailed configuration instructions
2. **Quick Change**: Modify the `TARGET_FILE_EXTENSION` constant in `src/customFileEditorProvider.ts`

## Development

### Local Development
See [DEVELOPMENT.md](./DEVELOPMENT.md) for complete development setup and testing instructions.

Quick start:
```bash
# Install dependencies
npm install

# Start development mode
npm run dev

# Test the extension (opens Extension Development Host)
# Press F5 in VS Code
```

### Local Building & Installation
See [RELEASING.md](./RELEASING.md) for complete build and release instructions.

Quick commands:
```bash
# Build and install locally
npm run release:local

# Just test the build process
npm run verify:package
```

## Project Structure

```
├── src/
│   ├── extension.ts                 # Extension entry point
│   ├── common/
│   │   ├── logger.ts                # Shared logging utility
│   │   ├── types.ts                 # Common TypeScript interfaces
│   │   └── utils.ts                 # Common utility functions
│   ├── editor/
│   │   ├── RuleDocument.ts          # Document parsing logic
│   │   └── RuleEditorProvider.ts    # Main editor provider
│   ├── explorer/
│   │   └── RulesTreeProvider.ts     # File tree view provider
│   ├── settings/
│   │   └── SettingsProvider.ts      # Settings webview provider
│   └── webviews/
│       ├── main.tsx                 # Webview entry point
│       ├── rule-editor/             # Rule editor React components
│       ├── settings/                # Settings React components
│       └── styles/                  # Webview CSS styles
├── .vscode/                         # VS Code configuration
├── test/                           # Test files
├── scripts/                        # Build and test scripts
└── docs/                           # Documentation
```

## Requirements

- **VS Code**: Version 1.85.0 or higher
- **Node.js**: Version 16+ (for development)

## Uninstallation

```bash
code --uninstall-extension cursor-workbench.cursor-workbench
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test using the development workflow
5. Submit a pull request

## License

ISC

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and changes.

---

## Release Process

This extension uses automated GitHub Actions for testing and releasing:

- **Continuous Integration**: Automatically tests all changes
- **Automated Releases**: Creates GitHub releases when version tags are pushed
- **Easy Distribution**: Download `.vsix` files directly from GitHub releases

For maintainers: See [docs/VERSIONING.md](./docs/VERSIONING.md) for release creation instructions.

## Package Information

- **Size**: ~10KB (highly optimized)
- **Files**: 14 files total
- **Performance**: Fast loading and minimal memory footprint
- **Compatibility**: VS Code 1.85.0+

*This extension follows VS Code best practices for optimal performance and size.*

## Quick Links

- 📖 [Development Guide](./DEVELOPMENT.md)
- 🚀 [Release Guide](./RELEASING.md)
- ⚙️ [Configuration Guide](./EXTENSION_CONFIG.md)
- 🏷️ [Versioning Guide](./docs/VERSIONING.md)
- ⚡ [Optimization Guide](./docs/OPTIMIZATION.md)
- 📋 [Latest Release](../../releases/latest)
- 🐛 [Report Issues](../../issues)

# Project Structure and Best Practices

This extension follows best practices for VS Code extension development:

## Directory Structure

```
cursor-workbench/
├── bin/                   # Compiled output (generated, gitignored)
├── dist/                  # Distribution files (.vsix packages, gitignored)
├── docs/                  # Documentation files
├── scripts/               # Build and utility scripts
│   ├── build.js           # Build script for the extension
│   ├── release-local.js   # Local release script
│   ├── test-local.js      # Simple tests
│   └── verify-package.js  # Package verification
├── src/                   # Source code
│   ├── common/            # Shared utilities
│   ├── editor/            # Editor implementation
│   ├── explorer/          # Explorer view
│   ├── settings/          # Settings implementation
│   └── webviews/          # Webview components
├── test/                  # Test files
├── .env.example           # Example environment variables
├── biome.json             # Biome configuration
├── CHANGELOG.md           # Changelog
├── package.json           # Extension manifest
├── README.md              # Project documentation
├── test.rule              # Sample rule file
└── tsconfig.json          # TypeScript configuration
```

## Development Workflow

1. **Hot Reload Development** (Recommended):
   ```bash
   npm run hot-reload
   ```
   This will automatically rebuild the extension when files change and reload VS Code.

2. **Build and Package**:
   ```bash
   npm run build         # Build the extension
   npm run package       # Package as .vsix
   npm run dev:install   # Build, package and install locally
   ```

3. **Testing**:
   ```bash
   npm run test:local    # Run basic tests
   npm run verify:package # Verify packaging works
   ```

## Release Process

The extension uses semantic versioning. Packages are created in the `dist/` directory:

```bash
npm run release:local   # Full local release process
```

This script builds, packages, and installs the extension in both VS Code and Cursor (if available).

For publishing to the marketplace, use:

```bash
vsce publish           # Requires marketplace publisher access
```
