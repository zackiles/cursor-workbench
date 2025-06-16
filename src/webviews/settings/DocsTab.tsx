import React from 'react'
import { marked } from 'marked'
import type { VSCodeAPI } from '../../common/types'
import './DocsTab.css'

interface DocsTabProps {
  vscode: VSCodeAPI
}

// Simple static documentation content
const DOCS_CONTENT = `
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
`;

// Configure marked for better VS Code integration
marked.setOptions({
  breaks: true,
  gfm: true
});

export const DocsTab = ({ vscode }: DocsTabProps) => {
  return (
    <div className="docs-container">
      <div className="content-header">
        <h1 className="content-title">Documentation</h1>
      </div>
            <div
        className="markdown-content"
        // Safe to use dangerouslySetInnerHTML here as DOCS_CONTENT is static content controlled by us
        dangerouslySetInnerHTML={{ __html: marked(DOCS_CONTENT) }}
      />
    </div>
  )
}
