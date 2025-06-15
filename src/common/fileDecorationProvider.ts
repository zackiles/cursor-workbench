import * as vscode from 'vscode'
import { registryManager } from './registryManager'

export class FileDecorationProvider implements vscode.FileDecorationProvider {
  private _onDidChangeFileDecorations = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >()
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event

  private ruleFileExtensions = [
    '.rule',
    '.mdc',
    '.md',
    '.yml',
    '.yaml',
    '.json'
  ]

  constructor() {
    // Listen for registry changes to update decorations
    registryManager.onDidChangeRegistry(() => {
      this._onDidChangeFileDecorations.fire(undefined)
    })
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    // Only process files with supported rule extensions
    const isRuleFile = this.ruleFileExtensions.some((ext) =>
      uri.fsPath.toLowerCase().endsWith(ext)
    )

    if (!isRuleFile) {
      return undefined
    }

    // Check if this is a virtual file from cursorfs scheme
    if (uri.scheme === 'cursorfs') {
      const teamRegistry = registryManager.getTeamRegistry()

      if (teamRegistry) {
        const repositoryName = this.extractRepositoryName(teamRegistry.url)
        return {
          tooltip: `(team): ${repositoryName}`,
          badge: 'T',
          color: new vscode.ThemeColor(
            'gitDecoration.modifiedResourceForeground'
          )
        }
      }
    }

    // Check if this is a local file that matches a virtual file
    const teamRegistry = registryManager.getTeamRegistry()
    if (teamRegistry) {
      // Convert absolute path to relative .cursor path for comparison
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (workspaceRoot && uri.fsPath.startsWith(workspaceRoot)) {
        const relativePath = uri.fsPath
          .substring(workspaceRoot.length)
          .replace(/\\/g, '/')
        const normalizedPath = relativePath.startsWith('/')
          ? relativePath.substring(1)
          : relativePath

        // Check if this file exists in the team registry
        if (teamRegistry.files.includes(normalizedPath)) {
          const repositoryName = this.extractRepositoryName(teamRegistry.url)
          return {
            tooltip: `(team): ${repositoryName}`,
            badge: 'T',
            color: new vscode.ThemeColor(
              'gitDecoration.modifiedResourceForeground'
            )
          }
        }
      }
    }

    // TODO: Add user registry support when implemented
    // For now, we only support team registries

    return undefined
  }

  private extractRepositoryName(gitUrl: string): string {
    try {
      // Handle different Git URL formats:
      // git@github.com:user/repo.git -> user/repo
      // https://github.com/user/repo.git -> user/repo
      // https://github.com/user/repo -> user/repo

      let repoPath = gitUrl

      // Remove .git suffix if present
      if (repoPath.endsWith('.git')) {
        repoPath = repoPath.slice(0, -4)
      }

      // Extract user/repo from SSH format: git@host:user/repo
      if (repoPath.includes('@') && repoPath.includes(':')) {
        const parts = repoPath.split(':')
        if (parts.length >= 2) {
          repoPath = parts[parts.length - 1]
        }
      }

      // Extract user/repo from HTTPS format: https://host/user/repo
      if (repoPath.startsWith('http')) {
        const url = new URL(repoPath)
        repoPath = url.pathname.startsWith('/')
          ? url.pathname.substring(1)
          : url.pathname
      }

      // Return the user/repo part or the full path if extraction failed
      return repoPath || gitUrl
    } catch (error) {
      // If parsing fails, return the original URL
      return gitUrl
    }
  }

  refresh(): void {
    this._onDidChangeFileDecorations.fire(undefined)
  }
}

export const fileDecorationProvider = new FileDecorationProvider()
