import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'
import { configManager } from '../common/configManager'
import { logger } from '../common/logger'
import { registryManager } from '../common/registryManager'

export class RulesTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly resourceUri?: vscode.Uri,
    public readonly isFile: boolean = false,
    public readonly registryType?: 'team' | 'user' | 'local'
  ) {
    super(label, collapsibleState)

    if (isFile && resourceUri) {
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [resourceUri]
      }

      // Set context value and icon based on registry type
      if (registryType === 'team') {
        this.contextValue = 'virtualRuleFile'
        this.iconPath = new vscode.ThemeIcon('organization')
      } else if (registryType === 'user') {
        this.contextValue = 'virtualRuleFile'
        this.iconPath = new vscode.ThemeIcon('person')
      } else {
        this.contextValue = 'ruleFile'
        this.iconPath = new vscode.ThemeIcon('file')
      }
    } else if (!isFile) {
      this.contextValue = 'ruleFolder'
      this.iconPath = new vscode.ThemeIcon('folder')
    }
  }
}

export class RulesTreeProvider
  implements vscode.TreeDataProvider<RulesTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    RulesTreeItem | undefined | null
  > = new vscode.EventEmitter<RulesTreeItem | undefined | null>()
  readonly onDidChangeTreeData: vscode.Event<RulesTreeItem | undefined | null> =
    this._onDidChangeTreeData.event

  constructor(private workspaceRoot: string | undefined) {
    // Listen for registry changes and refresh the tree
    registryManager.onDidChangeRegistry(() => {
      this.refresh()
    })
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined)
  }

  getTreeItem(element: RulesTreeItem): vscode.TreeItem {
    return element
  }

  getChildren(element?: RulesTreeItem): Thenable<RulesTreeItem[]> {
    if (!this.workspaceRoot) {
      return Promise.resolve([])
    }

    const rulesPath = path.join(this.workspaceRoot, '.cursor', 'rules')

    if (!element) {
      // Root level - return folders and files in .cursor/rules
      return this.getRulesStructure(rulesPath)
    } else {
      // Get children of a folder
      if (element.resourceUri && !element.isFile) {
        return this.getDirectoryContents(element.resourceUri.fsPath)
      }
      return Promise.resolve([])
    }
  }

  private async getRulesStructure(rulesPath: string): Promise<RulesTreeItem[]> {
    try {
      const items: RulesTreeItem[] = []
      const addedPaths = new Set<string>() // Track added file paths to avoid duplicates
      const folderNames = new Set<string>() // Track folder names

      // Add local files if they exist
      if (fs.existsSync(rulesPath)) {
        const entries = await fs.promises.readdir(rulesPath, {
          withFileTypes: true
        })

        // Sort: folders first, then files
        entries.sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1
          if (!a.isDirectory() && b.isDirectory()) return 1
          return a.name.localeCompare(b.name)
        })

        for (const entry of entries) {
          const fullPath = path.join(rulesPath, entry.name)
          const uri = vscode.Uri.file(fullPath)

          if (entry.isDirectory()) {
            folderNames.add(entry.name)
            const hasChildren = await this.hasRuleFiles(fullPath)
            items.push(
              new RulesTreeItem(
                entry.name,
                hasChildren
                  ? vscode.TreeItemCollapsibleState.Collapsed
                  : vscode.TreeItemCollapsibleState.None,
                uri,
                false,
                'local'
              )
            )
          } else if (this.isRuleFile(entry.name)) {
            items.push(
              new RulesTreeItem(
                entry.name,
                vscode.TreeItemCollapsibleState.None,
                uri,
                true,
                'local'
              )
            )
            addedPaths.add(entry.name)
          }
        }
      }

      // Add virtual files from team registry that belong at this level
      const teamRegistry = registryManager.getTeamRegistry()
      if (teamRegistry && this.workspaceRoot) {
        // Get the relative path from workspace root to current rules path
        const relativePath = path
          .relative(this.workspaceRoot, rulesPath)
          .replace(/\\/g, '/')

        for (const virtualFile of teamRegistry.files) {
          // Normalize the virtual file path
          const normalizedVirtualFile = virtualFile.replace(/\\/g, '/')
          const virtualFileDir = path
            .dirname(normalizedVirtualFile)
            .replace(/\\/g, '/')
          const fileName = path.basename(virtualFile)

          // Check if this virtual file belongs at the current directory level
          if (virtualFileDir === relativePath) {
            // Skip if we already have this file locally at this exact path
            if (addedPaths.has(fileName)) {
              continue
            }

            const virtualPath = path.join(this.workspaceRoot, virtualFile)
            const cursorfsUri = vscode.Uri.parse(`cursorfs:${virtualPath}`)

            // Create virtual tree item with cursorfs scheme
            const virtualItem = new RulesTreeItem(
              `${fileName} (team)`,
              vscode.TreeItemCollapsibleState.None,
              cursorfsUri,
              true,
              'team'
            )

            // Add special styling for virtual files
            virtualItem.tooltip = `Virtual file from team registry: ${virtualFile}`

            items.push(virtualItem)
            addedPaths.add(fileName)
          }
        }
      }

      return items
    } catch (error) {
      logger.log('Error reading rules directory', error)
      return []
    }
  }

  private async getDirectoryContents(
    dirPath: string
  ): Promise<RulesTreeItem[]> {
    try {
      const items: RulesTreeItem[] = []
      const addedPaths = new Set<string>() // Track added file paths to avoid duplicates

      // Add local files
      if (fs.existsSync(dirPath)) {
        const entries = await fs.promises.readdir(dirPath, {
          withFileTypes: true
        })

        // Sort: folders first, then files
        entries.sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1
          if (!a.isDirectory() && b.isDirectory()) return 1
          return a.name.localeCompare(b.name)
        })

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name)
          const uri = vscode.Uri.file(fullPath)

          if (entry.isDirectory()) {
            const hasChildren = await this.hasRuleFiles(fullPath)
            items.push(
              new RulesTreeItem(
                entry.name,
                hasChildren
                  ? vscode.TreeItemCollapsibleState.Collapsed
                  : vscode.TreeItemCollapsibleState.None,
                uri,
                false,
                'local'
              )
            )
          } else if (this.isRuleFile(entry.name)) {
            items.push(
              new RulesTreeItem(
                entry.name,
                vscode.TreeItemCollapsibleState.None,
                uri,
                true,
                'local'
              )
            )
            addedPaths.add(entry.name)
          }
        }
      }

      // Add virtual files from team registry that belong at this directory level
      const teamRegistry = registryManager.getTeamRegistry()
      if (teamRegistry && this.workspaceRoot) {
        // Get the relative path from workspace root to current directory
        const relativePath = path
          .relative(this.workspaceRoot, dirPath)
          .replace(/\\/g, '/')

        for (const virtualFile of teamRegistry.files) {
          // Normalize the virtual file path
          const normalizedVirtualFile = virtualFile.replace(/\\/g, '/')
          const virtualFileDir = path
            .dirname(normalizedVirtualFile)
            .replace(/\\/g, '/')
          const fileName = path.basename(virtualFile)

          // Check if this virtual file belongs at the current directory level
          if (virtualFileDir === relativePath) {
            // Skip if we already have this file locally at this exact path
            if (addedPaths.has(fileName)) {
              continue
            }

            const virtualPath = path.join(this.workspaceRoot, virtualFile)
            const cursorfsUri = vscode.Uri.parse(`cursorfs:${virtualPath}`)

            // Create virtual tree item with cursorfs scheme
            const virtualItem = new RulesTreeItem(
              `${fileName} (team)`,
              vscode.TreeItemCollapsibleState.None,
              cursorfsUri,
              true,
              'team'
            )

            // Add special styling for virtual files
            virtualItem.tooltip = `Virtual file from team registry: ${virtualFile}`

            items.push(virtualItem)
            addedPaths.add(fileName)
          }
        }
      }

      return items
    } catch (error) {
      logger.log('Error reading directory contents', error)
      return []
    }
  }

  private async hasRuleFiles(dirPath: string): Promise<boolean> {
    try {
      // Check local files first
      if (fs.existsSync(dirPath)) {
        const entries = await fs.promises.readdir(dirPath, {
          withFileTypes: true
        })

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const hasNested = await this.hasRuleFiles(
              path.join(dirPath, entry.name)
            )
            if (hasNested) return true
          } else if (this.isRuleFile(entry.name)) {
            return true
          }
        }
      }

      // Check for virtual files in this directory or subdirectories
      const teamRegistry = registryManager.getTeamRegistry()
      if (teamRegistry && this.workspaceRoot) {
        const relativePath = path
          .relative(this.workspaceRoot, dirPath)
          .replace(/\\/g, '/')

        for (const virtualFile of teamRegistry.files) {
          const normalizedVirtualFile = virtualFile.replace(/\\/g, '/')
          const virtualFileDir = path
            .dirname(normalizedVirtualFile)
            .replace(/\\/g, '/')

          // Check if this virtual file is in this directory or a subdirectory
          if (
            virtualFileDir === relativePath ||
            virtualFileDir.startsWith(`${relativePath}/`)
          ) {
            return true
          }
        }
      }

      return false
    } catch (error) {
      return false
    }
  }

  private isRuleFile(fileName: string): boolean {
    return configManager.isRuleFile(fileName)
  }

  async syncFile(item: RulesTreeItem): Promise<void> {
    if (!item.resourceUri) {
      vscode.window.showErrorMessage('No file selected for sync')
      return
    }

    // TODO: Implement individual file sync functionality
    const fileName = path.basename(item.resourceUri.fsPath)
    vscode.window.showInformationMessage(
      `Sync functionality for "${fileName}" coming soon!`
    )
    logger.log('Sync file requested', {
      file: fileName,
      path: item.resourceUri.fsPath
    })
  }
}
