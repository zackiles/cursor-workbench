# Development Guide

This guide explains how to develop and test the Custom File Editor VS Code extension locally.

## Prerequisites

- VS Code installed
- Node.js and npm installed
- Extension dependencies installed: `npm install`

## Local Development & Testing

### Method 1: Extension Development Host (Recommended)

This is the standard VS Code extension development approach:

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

### Method 2: Watch Mode Development

For continuous development with automatic rebuilding:

1. **Start watch mode**
   ```bash
   npm run watch
   ```
   This will rebuild the extension automatically when files change.

2. **Launch Extension Development Host**
   - Use `F5` or the debug configuration as above
   - The extension will use the latest built version

### Method 3: Package and Install Locally

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
├── main.ts                      # Extension entry point
├── customFileEditorProvider.ts  # Main editor provider logic
└── customFileDocument.ts        # Document parsing logic

.vscode/
├── launch.json                  # Debug configurations
└── tasks.json                   # Build tasks

bin/                             # Compiled output (generated)
└── main.js                      # Compiled extension

test.rule                        # Sample test file
```

## Changing File Extensions

To test with different file extensions:

1. Update `TARGET_FILE_EXTENSION` in `src/customFileEditorProvider.ts`
2. Update `filenamePattern` in `package.json`
3. Rebuild: `npm run build`
4. Reload the Extension Development Host

## Common Issues

- **Extension not loading**: Check that `npm run build` completed successfully
- **Custom editor not opening**: Verify file extension matches configuration
- **Changes not reflecting**: Make sure to reload the Extension Development Host after code changes
- **Build errors**: Check TypeScript compilation errors in the terminal
