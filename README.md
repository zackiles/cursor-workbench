# Cursor Workbench - Rule Editor Extension

A VS Code extension specifically designed for the **Cursor IDE** to edit and manage Cursor rules that are shared across projects and your team, with Git synchronization, and intuitive configuration.

## 🎯 What This Extension Does

- 🎨 **Custom Rule Editor** - Custom editor specifically designed for Cursor rule files
- 🤝 **Team Collaboration** - Synchronize rule files across teams using Git repositories automatically
- 📝 **Smart Frontmatter** - Intelligent attachment type detection (Always, Auto, Agent, Manual)
- 🔄 **Git Integration** - Real-time status indicators with commit/push/pull functionality
- 🌐 **Remote Registries** - Connect to team rule repositories for shared configurations
- 💾 **Real-time Sync** - Changes are saved automatically with conflict resolution
- 🎯 **Cursor-Specific** - Built specifically for Cursor IDE's rule system and workflow

## 🚀 Key Features

### Smart Rule Management
- **Attachment Types**: Automatically categorize rules as Always, Auto, Agent, or Manual based on frontmatter
- **File Pattern Matching**: Configure glob patterns for auto-attached rules
- **Agent Descriptions**: Add semantic descriptions for AI agent rule selection
- **Notes System**: Expandable notes section for additional context

### Team Collaboration
- **Team Registries**: Connect to Git repositories containing shared rule files
- **Real-time Status**: Visual indicators showing local vs remote file status
- **Conflict Resolution**: Smart merge handling for concurrent edits
- **Repository Management**: Easy setup and management of team rule repositories

### Git Integration
- **Status Indicators**: Green/Yellow/Red/Gray dots showing file sync status
- **Interactive Modals**: Click status indicators for commit/push/pull actions
- **Automatic Staging**: Streamlined workflow for rule file updates
- **Branch Management**: Handles rebasing and conflict resolution

### Advanced Editor
- **Live Preview**: See rule scope (team/user/project/local) and format
- **Syntax Highlighting**: Proper YAML frontmatter and Markdown content support
- **Theme Integration**: Seamlessly integrates with VS Code/Cursor themes
- **Keyboard Shortcuts**: Efficient editing with familiar shortcuts

## 📦 Installation

### From Open VSX Registry (Recommended for Cursor IDE)

Since this extension is designed specifically for Cursor IDE (a VS Code fork), you can install it from the Open VSX Registry:

1. **Install via Cursor Extensions**
   - Open Cursor IDE
   - Go to Extensions (`Ctrl/Cmd+Shift+X`)
   - Search for "Cursor Workbench" or "@zackiles/cursor-workbench"
   - Click "Install"

2. **Install via Command Line**
   ```bash
   # Ensure 'cursor' is on your PATH (run the 'install cursor' command in the command-palette)
   cursor --install-extension zackiles.cursor-workbench

   # Or for VS Code (if using with VS Code)
   code --install-extension zackiles.cursor-workbench
   ```

3. **Browse on Open VSX**
   - Visit: [https://open-vsx.org/extension/zackiles/cursor-workbench](https://open-vsx.org/extension/zackiles/cursor-workbench)

### Alternative: From GitHub Releases

1. **Download the Extension**
   - Go to the [Releases page](../../releases)
   - Download the latest `.vsix` file (e.g., `cursor-workbench-0.0.1.vsix`)

2. **Install via Command Line**
   ```bash
   cursor --install-extension cursor-workbench-0.0.1.vsix
   ```

3. **Or Install via Cursor/VS Code UI**
   - Open Cursor or VS Code
   - Go to Extensions (`Ctrl/Cmd+Shift+X`)
   - Click the "..." menu (Views and More Actions)
   - Select "Install from VSIX..."
   - Choose the downloaded `.vsix` file

### Verify Installation

After installation, you can verify the extension is active:
```bash
cursor --list-extensions | grep cursor-workbench
# or
code --list-extensions | grep cursor-workbench
```

## 🎮 Usage

### Basic Rule Editing

1. **Create or open a `.rule` or `.mdc` file** in your Cursor IDE
2. **The custom editor opens automatically** for supported file types
3. **Edit your rule**:
   - **Attachment Type**: Choose how the rule should be attached (Always/Auto/Agent/Manual)
   - **File Patterns**: For auto-attached rules, specify glob patterns (e.g., `**/*.tsx, src/**/*.js`)
   - **Description**: For agent rules, describe when the AI should use this rule
   - **Content**: Write your rule content in Markdown
4. **Save normally** (`Ctrl/Cmd+S`) - changes are synchronized automatically

### Team Collaboration Setup

1. **Open Settings**: Click the gear icon in the rule editor or use the Cursor Workbench panel
2. **Add Team Registry**: Enter your team's Git repository URL
3. **Sync Rules**: The extension automatically creates symlinks and manages synchronization
4. **Monitor Status**: Watch the status indicators for real-time sync information

### Git Workflow

- **Green Dot**: File is up-to-date with remote
- **Yellow Dot**: Local commits need to be pushed OR remote changes need to be pulled
- **Red Dot**: Uncommitted local changes OR conflicts need resolution
- **Gray Dot**: No remote repository configured

Click any status indicator to see available actions (commit, push, pull, rebase).

### Example Rule Structure

```yaml
---
attachmentType: auto
globs: **/*.tsx, **/*.jsx
description: React component development rules
alwaysApply: false
---

# React Component Rules

When working with React components:

1. Use functional components with hooks
2. Follow the component naming convention: PascalCase
3. Include proper TypeScript types for props
4. Add JSDoc comments for complex components

## File Patterns
This rule applies to all TypeScript and JavaScript React files.
```

## 🔧 Configuration

### Supported File Extensions

Currently configured for:
- `.rule` files (Cursor rule files)
- `.mdc` files (Markdown with frontmatter)

### Attachment Types

- **Always**: Rule is always attached to conversations (alwaysApply: true)
- **Auto**: Rule is attached based on file patterns (requires globs)
- **Agent**: Rule is attached when AI determines relevance (requires description)
- **Manual**: Rule is manually attached by user

### Team Registry Setup

1. Create a Git repository for your team rules
2. Add a `.cursor` folder with your rule files
3. Configure the repository URL in extension settings
4. Team members can sync and collaborate on rules

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

## 🐛 Troubleshooting

### Common Issues

**Extension not opening for rule files:**
- Check that the extension is enabled in settings
- Verify file extensions are configured correctly

**Git sync not working:**
- Ensure Git is installed and accessible
- Check repository URL and permissions
- Verify network connectivity

**Status indicators not updating:**
- Try refreshing the file explorer
- Check the output panel for error messages

## 🔗 Quick Links

- ⚙️ [Configuration Guide](./EXTENSION_CONFIG.md)
- 📦 [Publishing Guide](./PUBLISHING.md)
- 📋 [Latest Release](../../releases/latest)
- 🌐 [Open VSX Registry](https://open-vsx.org/extension/zackiles/cursor-workbench)
- 🐛 [Report Issues](../../issues)
- 📖 [Cursor IDE Documentation](https://docs.cursor.sh/)

## 📄 License

ISC

## 🏷️ Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and changes.

---

**Built specifically for Cursor IDE** - Enhancing your AI-powered development workflow with intelligent rule management and team collaboration.
