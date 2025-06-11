# Development Guide

This guide explains how to develop and test the Cursor Workbench VS Code extension locally.

## Prerequisites

- VS Code installed
- Node.js and npm installed
- Extension dependencies installed: `npm install`

## Local Development & Testing

### Method 1: Hot Reload Development (Recommended)

For the best development experience with automatic rebuilding and reloading:

1. **Start hot reload mode**
   ```bash
   npm run hot-reload
   ```
   This will:
   - Automatically rebuild the extension when files change
   - Automatically reload the VS Code window after rebuilding
   - Provide immediate feedback for your changes

2. **Open a test project in a separate VS Code window**
   - Create or open a folder with `.rule` files
   - The custom editor will update automatically as you make changes

### Method 2: Extension Development Host

The standard VS Code extension development approach:

1. **Open the project in VS Code**
   ```bash
   code .
   ```

2. **Run the extension in development mode**
   - Press `F5` or use the Command Palette: `Debug: Start Debugging`
   - Or go to Run and Debug view (Ctrl/Cmd+Shift+D) and click "Run Extension"
   - This will open a new VS Code window titled `[Extension Development Host]`

3. **Test the extension**
   - In the Extension Development Host window, create or open a `.rule` file
   - The custom editor should automatically open for `.rule` files
   - Test editing the front matter fields and content

4. **Making changes**
   - Edit the source code in the main VS Code window
   - Press `Ctrl/Cmd+Shift+F5` to reload the Extension Development Host window
   - Or use Command Palette: `Developer: Reload Window` in the Extension Development Host

### Method 3: Watch Mode Development

For continuous development with automatic rebuilding:

1. **Start watch mode**
   ```bash
   npm run watch
   ```
   This will rebuild the extension automatically when files change.

2. **Launch Extension Development Host**
   - Use `F5` or the debug configuration as above
   - The extension will use the latest built version

### Method 4: Package and Install Locally

To test the extension as an installed extension:

1. **Build and package the extension**
   ```bash
   npm run build
   npm run package
   ```

2. **Install the packaged extension**
   ```bash
   code --install-extension cursor-workbench-0.0.1.vsix
   ```

3. **Test in regular VS Code**
   - Open any `.rule` file in VS Code
   - The custom editor should be available

4. **Uninstall when done testing**
   ```bash
   npm run uninstall-extension
   ```

## Quick Local Tests

Before running the full extension tests, you can run a quick validation:

```bash
npm run test:local
```

This script verifies:
- Build output exists
- Package.json configuration is correct
- Front matter parsing works
- VS Code configuration files are present

## Testing Checklist

When testing the extension, verify these features:

- [ ] Custom editor opens for `.rule` files
- [ ] Front matter parsing works correctly
- [ ] Rule field can be edited and saves properly
- [ ] Globs field can be edited and saves properly
- [ ] Content area can be edited and saves properly
- [ ] Changes are persisted when saving the file
- [ ] VS Code theming is applied correctly
- [ ] Extension works with files that have no front matter
- [ ] Extension handles malformed YAML front matter gracefully

## Debugging

- Set breakpoints in the TypeScript source files
- Use the VS Code debugger when running the Extension Development Host
- Check the Developer Console in the Extension Development Host for errors
- Use `console.log()` statements in the source code for debugging

## File Structure

```
src/
├── extension.ts                    # Extension entry point
├── common/
│   ├── logger.ts                   # Shared logging utility
│   ├── types.ts                    # Common TypeScript interfaces
│   └── utils.ts                    # Common utility functions
├── editor/
│   ├── RuleDocument.ts             # Document parsing logic
│   └── RuleEditorProvider.ts       # Main editor provider logic
├── explorer/
│   └── RulesTreeProvider.ts        # File tree view provider
├── settings/
│   └── SettingsProvider.ts         # Settings webview provider
└── webviews/
    ├── main.tsx                    # Webview entry point
    ├── styles/
    │   └── base.css                # Base webview styles
    ├── rule-editor/
    │   ├── RuleEditor.tsx          # Rule editor React component
    │   └── RuleEditor.css          # Rule editor styles
    └── settings/
        ├── Settings.tsx            # Settings React component
        ├── Settings.css            # Settings styles
        ├── GeneralTab.tsx          # General settings tab
        ├── DebugTab.tsx            # Debug settings tab
        └── DocsTab.tsx             # Documentation tab

.vscode/
├── launch.json                     # Debug configurations
└── tasks.json                      # Build tasks

bin/                                # Compiled output (generated)
├── extension.js                    # Compiled extension
├── webview.js                      # Compiled webview bundle
└── webview.css                     # Compiled styles

test.rule                           # Sample test file
```

## Changing File Extensions

To test with different file extensions:

1. Update the file pattern in `src/editor/RuleEditorProvider.ts`
2. Update `filenamePattern` in `package.json`
3. Rebuild: `npm run build`
4. Reload the Extension Development Host

## Common Issues

- **Extension not loading**: Check that `npm run build` completed successfully
- **Custom editor not opening**: Verify file extension matches configuration
- **Changes not reflecting**: Make sure to reload the Extension Development Host after code changes
- **Build errors**: Check TypeScript compilation errors in the terminal

## Development Workflow

### Making Changes to Extension Logic
1. Edit files in `src/editor/`, `src/explorer/`, or `src/settings/`
2. Run `npm run build` or `npm run watch`
3. Reload Extension Development Host (`Ctrl/Cmd+Shift+F5`)

### Making Changes to Webview Components
1. Edit React components in `src/webviews/`
2. Run `npm run build` or `npm run watch`
3. Reload Extension Development Host

### Adding New Features
1. Add backend logic to appropriate feature directory
2. Add webview components if needed
3. Update `src/extension.ts` to register new providers
4. Update `package.json` for new contributions
5. Test in Extension Development Host
