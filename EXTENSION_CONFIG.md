# Custom File Editor Configuration

This VS Code extension provides a custom editor for files with YAML front matter. The extension is designed to be easily configurable for different file extensions.

## How to Change the Target File Extension

To change the file extension that the editor works with, you need to update two files:

### 1. Update `src/customFileEditorProvider.ts`

Change the `TARGET_FILE_EXTENSION` constant at the top of the file:

```typescript
// File extension configuration - change this to update the supported file extension
const TARGET_FILE_EXTENSION = '*.rule'  // Change this to your desired extension
const EDITOR_VIEW_TYPE = 'customFileEditor'
const EDITOR_DISPLAY_NAME = 'Custom File Editor'
```

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

To modify or add fields, update the parsing logic in `src/customFileDocument.ts` and the HTML form in `src/customFileEditorProvider.ts`.

## Build Process

After making changes, rebuild the extension:

```bash
npm run build
```

The compiled extension will be available in the `bin/` directory.
