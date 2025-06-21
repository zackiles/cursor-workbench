# Contributing to Cursor Workbench

This guide provides information for developers and contributors interested in working on the Cursor Workbench extension.

## 🏗️ Project Structure

```
cursor-workbench/
├── src/
│   ├── common/
│   │   ├── types.ts              # AttachmentType enum and interfaces
│   │   ├── registryManager.ts    # Git repository management
│   │   ├── fileDecorationProvider.ts # File status indicators
│   │   └── configManager.ts      # Extension configuration
│   ├── editor/
│   │   ├── RuleDocument.ts       # Rule parsing and frontmatter handling
│   │   └── RuleEditorProvider.ts # Main editor implementation
│   ├── explorer/
│   │   ├── RulesTreeProvider.ts  # File tree view
│   │   └── CursorFileSystemProvider.ts # Virtual file system
│   ├── settings/
│   │   └── SettingsProvider.ts   # Settings webview
│   └── webviews/
│       ├── rule-editor/          # React rule editor components
│       ├── settings/             # Settings React components
│       └── styles/               # CSS styling
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

This extension is automatically published to the Open VSX Registry when new version tags are created:

1. **Automatic Publishing** (Recommended)
   - Create a new git tag: `git tag v1.0.0 && git push origin v1.0.0`
   - GitHub Actions will automatically build and publish to Open VSX Registry

2. **Manual Publishing** (For testing)
   ```bash
   # Install Open VSX CLI
   npm install -g ovsx

   # Build and publish to Open VSX (requires OPEN_VSX_TOKEN environment variable)
   npm run build
   npm run release:ovsx
   ```

3. **Publishing Workflow**
   - `Test` workflow runs on pull requests and pushes
   - `Release` workflow runs on version tags, creates GitHub releases
   - `Publish to Open VSX Registry` workflow runs after successful releases

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
