# MDX Editor Integration

## Overview

The Cursor Workbench VS Code extension has been successfully updated to use MDX Editor for editing `.rule` files with YAML frontmatter and markdown content. The integration provides a rich markdown editing experience with frontmatter support.

## Features

### ✅ Implemented
- **MDX Editor Integration**: Replaced the basic textarea with a full-featured MDX Editor
- **Frontmatter Plugin**: Automatic parsing and editing of YAML frontmatter
- **Source Mode**: Clean, distraction-free markdown editing experience
- **VS Code Theme Integration**: Editor styling matches your VS Code theme
- **Real-time Sync**: Changes are immediately synchronized with the file system
- **React-based Webview**: Modern React components for better performance

### Key Components

#### 1. Frontmatter Support
The editor automatically parses YAML frontmatter with the following structure:
```yaml
---
rule: example-rule
globs: "*.ts,*.js"
---
```

#### 2. Markdown Content
Full markdown support including:
- Headers (`# ## ###`)
- **Bold** and *italic* text
- Lists and bullet points
- Code blocks
- And all standard markdown features

#### 3. VS Code Integration
- Matches VS Code color theme
- Uses VS Code font family
- Seamless integration with VS Code's file system
- Auto-save functionality

## Technical Implementation

### Architecture
```
Extension Host (Node.js)
├── src/extension.ts                      # Extension entry point
├── src/editor/
│   ├── RuleEditorProvider.ts             # Main editor provider
│   └── RuleDocument.ts                   # Document parsing
├── src/explorer/
│   └── RulesTreeProvider.ts              # File tree provider
├── src/settings/
│   └── SettingsProvider.ts               # Settings webview provider
├── src/common/
│   ├── logger.ts                         # Logging utility
│   ├── types.ts                          # Shared interfaces
│   └── utils.ts                          # Common utilities
└── src/webviews/                         # React components (Browser context)
    ├── main.tsx                          # Webview entry point
    ├── rule-editor/
    │   ├── RuleEditor.tsx                # Main MDX Editor component
    │   └── RuleEditor.css                # Editor styles
    ├── settings/
    │   ├── Settings.tsx                  # Settings component
    │   └── (other settings components)
    └── styles/
        └── base.css                      # Base webview styles
```

### Build System
- **Extension Bundle**: `src/extension.ts` → `bin/extension.js` (Node.js/CommonJS)
- **Webview Bundle**: `src/webviews/main.tsx` → `bin/webview.js` (Browser/IIFE)
- **React & JSX**: Full TypeScript support with React 19
- **MDX Editor CSS**: Embedded directly in the HTML for styling

### Data Flow
1. VS Code reads `.rule` file
2. `RuleDocument` parses frontmatter and content
3. Data sent to React webview via `postMessage`
4. MDX Editor renders with frontmatter plugin
5. Changes flow back through `postMessage` to update file

## Usage

### Opening Files
1. Create or open any `.rule` file in VS Code
2. The custom editor will automatically launch
3. Edit frontmatter and markdown content seamlessly

### File Format
```markdown
---
rule: your-rule-name
globs: "file-patterns"
---

# Your Markdown Content

Write your documentation, rules, or content here using full markdown syntax.
```

### Keyboard Shortcuts
- Standard markdown shortcuts work (e.g., `**` for bold)
- VS Code file operations (Ctrl+S to save)
- Standard text editing commands

## Development

### Building
```bash
npm run build          # Build both extension and webview
npm run watch          # Watch mode for development
npm run dev:install    # Build, package, and install locally
```

### Testing
1. Open `test.rule` in VS Code
2. Verify frontmatter editing works
3. Test markdown rendering and editing
4. Check theme integration

### Extending
The editor can be extended by:
- Adding more frontmatter fields in `src/editor/RuleDocument.ts`
- Adding MDX Editor plugins in `src/webviews/rule-editor/RuleEditor.tsx`
- Customizing styling in `src/webviews/rule-editor/RuleEditor.css`

## Dependencies

### Runtime
- `@mdxeditor/editor`: MDX Editor React component
- `react` & `react-dom`: React runtime for webview

### Development
- `@types/react` & `@types/react-dom`: TypeScript definitions
- `esbuild`: Fast bundling for both extension and webview
- `typescript`: Type checking and compilation

## Configuration

The editor behavior can be customized by modifying:

### File Extensions
Change the file pattern in `package.json`:
```json
{
  "contributes": {
    "customEditors": [
      {
        "selector": [
          {
            "filenamePattern": "*.rule"  // Change to your extension
          }
        ]
      }
    ]
  }
}
```

### Frontmatter Fields
Update parsing logic in:
- `src/editor/RuleDocument.ts` - Document parsing
- `src/webviews/rule-editor/RuleEditor.tsx` - React component
- `src/common/types.ts` - TypeScript interfaces

### Styling
Modify CSS in:
- `src/webviews/rule-editor/RuleEditor.css` - Editor-specific styles
- `src/webviews/styles/base.css` - Base webview styles

## Troubleshooting

### Common Issues

1. **Editor not loading**: Check VS Code Developer Console (Help → Toggle Developer Tools)
2. **Styling issues**: Verify MDX Editor CSS is loading correctly
3. **Build errors**: Ensure all dependencies are installed with `npm install`

### Debug Mode
Enable debug mode by setting `isDev = true` in `build.js` for:
- Source maps
- Unminified code
- Development builds

## Future Enhancements

Potential improvements:
- Additional MDX Editor plugins (tables, images, etc.)
- Custom toolbar buttons
- Advanced frontmatter validation
- Multi-language support
- Enhanced VS Code integration
