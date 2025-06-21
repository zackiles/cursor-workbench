import { marked } from 'marked'
import React from 'react'
import type { VSCodeAPI } from '../../common/types'
import './DocsTab.css'

interface DocsTabProps {
  vscode: VSCodeAPI
}

// Simple static documentation content
const DOCS_CONTENT = `
# Cursor Workbench - Rule Editor Extension

Cursor rules for teams and power users. Load, share, edit, version, and manage team and user rules across projects seamlessly without committing rules to your repo.

## 🎯 Features

- 🎨 **Powerful Rule Editor** - Custom rule editor unlocks functionality not available in Cursor. Version, tag, add usage notes, and organize your rules directly within the editor
- 🤝 **Rule Registry** - Synchronize team and user rules across projects using rule registries
- 💾 **Real-time Sync** - Update remote rule resgistries locally right within your editor

## 📦 Installation

Go to Extensions in Cursor(\`Ctrl/Cmd+Shift+X\`) and search for **\"Cursor Workbench\"** or **\"@zackiles/cursor-workbench\"** -> Click Install.

<img src=\"https://raw.githubusercontent.com/zackiles/cursor-workbench/refs/heads/main/snip1.png\">

## 🎮 Usage

### Adding a Registry

Create a public or private GitHub repository with a \`.cursor/rules\` folder that contains your rules, and add it in the Cursor Workbench Settings menu (found in the Command Palette or by clicking the gear icon in the rule editor).

<img src=\"https://raw.githubusercontent.com/zackiles/cursor-workbench/refs/heads/main/snip2.png\">

### Basic Rule Editing

Rule files ending in \`.mdc\` will open in Cursor Workbench automatically instead of the regular Cursor editor. Rules added from a registry will shown their status in the top right of the editor if your local copy of a rule is out of date or can be synchronized with the remote registry. Remote rules can be edited individually locally and pushed to the remote registry at your own leisure by clicking the globe icon in the top right.

<img src=\"https://raw.githubusercontent.com/zackiles/cursor-workbench/refs/heads/main/snip3.png\">

### Rule Status

- **Green Dot**: Rule is up-to-date with remote
- **Yellow Dot**: Rule has local or remote changes that can be synchronized
- **Red Dot**: Uncommitted local changes OR conflicts need resolution
- **Gray Dot**: No remote repository configured

Click any status indicator to see available actions (commit, push, pull, rebase).

## 🔧 Configuration

### Attachment Types

- **Always**: Rule is always attached to conversations (alwaysApply: true)
- **Auto**: Rule is attached based on file patterns (requires globs)
- **Agent**: Rule is attached when AI determines relevance (requires description)
- **Manual**: Rule is manually attached by user

## 🔗 Quick Links

- 📋 [Latest Release](../../releases/latest)
- 🌐 [Open VSX Registry](https://open-vsx.org/extension/zackiles/cursor-workbench)
- 📖 [Cursor IDE Documentation](https://docs.cursor.sh/)
- 🤝 [Contributing Guide](./CONTRIBUTING.md)
- 🏷️ [Changelog](./CHANGELog.md)
- 🐛 [Report Issues](../../issues)
`

// Configure marked for better VS Code integration
marked.setOptions({
  breaks: true,
  gfm: true
})

export const DocsTab = ({ vscode }: DocsTabProps) => {
  return (
    <div className='docs-container'>
      <div className='content-header'>
        <h1 className='content-title'>Documentation</h1>
      </div>
      <div
        className='markdown-content'
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe to use dangerouslySetInnerHTML here as DOCS_CONTENT is static content controlled by us
        dangerouslySetInnerHTML={{ __html: marked(DOCS_CONTENT) }}
      />
    </div>
  )
}
