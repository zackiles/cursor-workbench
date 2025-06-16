import * as vscode from 'vscode'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { registryManager } from './registryManager'
import { configManager } from './configManager'

export class FileDecorationProvider implements vscode.FileDecorationProvider {
  private _onDidChangeFileDecorations = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >()
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event

  constructor() {
    // Listen for registry changes to update decorations
    registryManager.onDidChangeRegistry(() => {
      this._onDidChangeFileDecorations.fire(undefined)
    })
  }

  async provideFileDecoration(
    uri: vscode.Uri
  ): Promise<vscode.FileDecoration | undefined> {
    // Only process files with supported rule extensions
    const isRuleFile = configManager.isRuleFile(uri.fsPath)

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

          try {
            // Get the file status to determine appropriate decoration
            const fileStatus =
              await registryManager.getFileStatus(normalizedPath)

            switch (fileStatus) {
              case 'modified':
                return {
                  tooltip: `(team): ${repositoryName} - Modified`,
                  badge: 'M',
                  color: new vscode.ThemeColor(
                    'gitDecoration.modifiedResourceForeground'
                  )
                }
              case 'untracked':
                return {
                  tooltip: `(team): ${repositoryName} - Untracked`,
                  badge: 'U',
                  color: new vscode.ThemeColor(
                    'gitDecoration.untrackedResourceForeground'
                  )
                }
              case 'unmodified':
                return {
                  tooltip: `(team): ${repositoryName}`,
                  badge: 'T',
                  color: new vscode.ThemeColor(
                    'gitDecoration.addedResourceForeground'
                  )
                }
            }
          } catch (error) {
            // If we can't get file status, fall back to basic team decoration
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
    }

    // Return decoration for local rule files
    return {
      tooltip: 'Rule File'
    }
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
