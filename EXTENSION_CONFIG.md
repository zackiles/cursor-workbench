# Cursor Workbench Extension Configuration

This VS Code extension provides a custom editor for files with YAML front matter. The extension is designed to be easily configurable for different file extensions.

## How to Change the Target File Extension

To change the file extension that the editor works with, you need to update the configuration in two files:

### 1. Update `src/editor/RuleEditorProvider.ts`

The file extension configuration is defined by the constants at the top of the file:

```typescript
// File extension configuration - change this to update the supported file extension
const EDITOR_VIEW_TYPE = 'customFileEditor'
const EDITOR_DISPLAY_NAME = 'Custom File Editor'
```

The actual file pattern is controlled by the `package.json` configuration (see below).

### 2. Update `package.json`

Update the `filenamePattern` in the `customEditors` section:

```json
{
  "contributes": {
    "customEditors": [
      {
        "viewType": "customFileEditor",
        "displayName": "Custom File Editor",
        "selector": [
          {
            "filenamePattern": "*.rule"  // Change this to match your file extension
          }
        ],
        "priority": "default"
      }
    ]
  }
}
```

## Current Configuration

- **File Extension**: `*.rule`
- **Editor Name**: Custom File Editor
- **View Type**: customFileEditor

## Front Matter Fields

The editor currently supports these YAML front matter fields:
- `rule`: A string field for rule names
- `globs`: A string field for file patterns

To modify or add fields, update the parsing logic in:
- `src/editor/RuleDocument.ts` - Document parsing and data model
- `src/webviews/rule-editor/RuleEditor.tsx` - React component for editing
- `src/common/types.ts` - TypeScript interface definitions

## Architecture Overview

The extension is organized by feature:

```
src/
├── editor/
│   ├── RuleDocument.ts           # Document parsing and data model
│   └── RuleEditorProvider.ts     # VS Code custom editor provider
├── webviews/
│   └── rule-editor/
│       ├── RuleEditor.tsx        # React component for the editor UI
│       └── RuleEditor.css        # Editor-specific styles
└── common/
    └── types.ts                  # Shared type definitions
```

## Build Process

After making changes, rebuild the extension:

```bash
npm run build
```

The compiled extension will be available in the `bin/` directory:
- `bin/extension.js` - Main extension code
- `bin/webview.js` - React webview bundle
- `bin/webview.css` - Compiled styles

## Advanced Configuration

### Adding New Front Matter Fields

1. **Update the data model** in `src/editor/RuleDocument.ts`:
   ```typescript
   export class RuleDocument {
     public readonly rule: string
     public readonly globs: string
     public readonly newField: string  // Add your new field
     // ...
   }
   ```

2. **Update the TypeScript interfaces** in `src/common/types.ts`:
   ```typescript
   export interface DocumentData {
     rule: string
     globs: string
     newField: string  // Add your new field
     // ...
   }
   ```

3. **Update the React component** in `src/webviews/rule-editor/RuleEditor.tsx`:
   ```tsx
   // Add form input for your new field
   <input
     type="text"
     value={frontmatter.newField || ''}
     onChange={(e) => setFrontmatter({
       ...frontmatter,
       newField: e.target.value
     })}
   />
   ```

### Customizing the Editor Appearance

Edit the CSS in `src/webviews/rule-editor/RuleEditor.css` to customize:
- Form field styling
- Layout and spacing
- Colors and typography
- Responsive behavior
