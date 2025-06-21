# Contributing to Cursor Workbench

This guide provides information for developers and contributors interested in working on the Cursor Workbench extension.

## 🏗️ Project Structure

```
cursor-workbench/
├── src/
│   ├── common/
│   │   ├── configManager.ts      # Extension configuration
│   │   ├── fileDecorationProvider.ts # File status indicators
│   │   ├── logger.ts             # Logging utility
│   │   ├── registryManager.ts    # Git repository management
│   │   ├── types.ts              # AttachmentType enum and interfaces
│   │   └── utils.ts              # General utility functions
│   ├── editor/
│   │   ├── RuleDocument.ts       # Rule parsing and frontmatter handling
│   │   └── RuleEditorProvider.ts # Main editor implementation
│   ├── explorer/
│   │   ├── CursorFileSystemProvider.ts # Virtual file system
│   │   └── RulesTreeProvider.ts  # File tree view
│   ├── settings/
│   │   └── SettingsProvider.ts   # Settings webview
│   ├── webviews/
│   │   ├── components/           # Reusable React components
│   │   ├── hooks/                # React hooks
│   │   ├── main.tsx              # Main entry point for webview
│   │   ├── rule-editor/          # React rule editor components
│   │   ├── settings/             # Settings React components
│   │   └── styles/               # CSS styling
│   └── extension.ts              # Main extension entry point
├── rule-icon.svg                 # Extension icon
└── test.rule                     # Example rule file
```

## 🔄 Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Start development mode (builds to /bin and watches for changes)
npm run dev

# Open Cursor Extension Development Host (F5) or manually:
code --extensionDevelopmentPath=. .
```

### Building & Testing

```bash
# Build for production (outputs to /dist with VSIX package)
npm run build

# Package extension (same as build, creates .vsix file)
npm run package

# Run tests
npm run test
```

### Publishing

For detailed instructions on publishing the extension to the Open VSX Registry, including automatic and manual release processes, please refer to the [Publishing Guide](PUBLISHING.md).

## 📋 Requirements

- **Cursor IDE or VS Code**: Version 1.85.0 or higher
- **Git**: Required for team collaboration features
- **Node.js**: Version 16+ (for development)

## 🤝 Team Collaboration Features

### Repository Structure
```
team-rules-repo/
└── .cursor/
    ├── rules/
    │   ├── team/
    │   │   ├── coding-standards.rule
    │   │   └── review-guidelines.rule
    │   └── global/
    │       └── company-policies.rule
```

### Sync Workflow
1. **Clone**: Extension clones team repository to local storage
2. **Symlink**: Creates symlinks in your project's `.cursor` folder
3. **Monitor**: Watches for changes and shows status indicators
4. **Sync**: Provides easy commit/push/pull through status indicators

## 🎨 Customization

### File Extensions
Modify `package.json` to support additional file extensions:

```json
{
  "contributes": {
    "customEditors": [
      {
        "selector": [
          { "filenamePattern": "*.rule" },
          { "filenamePattern": "*.mdc" },
          { "filenamePattern": "*.your-extension" }
        ]
      }
    ]
  }
}
```
