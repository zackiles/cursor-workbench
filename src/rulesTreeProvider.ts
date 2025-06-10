import * as vscode from 'vscode'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { logger } from './logger'

export class RulesTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly resourceUri?: vscode.Uri,
    public readonly isFile: boolean = false
  ) {
    super(label, collapsibleState)

    if (isFile && resourceUri) {
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [resourceUri]
      }
      this.contextValue = 'ruleFile'
      this.iconPath = new vscode.ThemeIcon('file')
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

  constructor(private workspaceRoot: string | undefined) {}

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
      if (!fs.existsSync(rulesPath)) {
        return []
      }

      const items: RulesTreeItem[] = []
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
          const hasChildren = await this.hasRuleFiles(fullPath)
          items.push(
            new RulesTreeItem(
              entry.name,
              hasChildren
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
              uri,
              false
            )
          )
        } else if (this.isRuleFile(entry.name)) {
          items.push(
            new RulesTreeItem(
              entry.name,
              vscode.TreeItemCollapsibleState.None,
              uri,
              true
            )
          )
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
              false
            )
          )
        } else if (this.isRuleFile(entry.name)) {
          items.push(
            new RulesTreeItem(
              entry.name,
              vscode.TreeItemCollapsibleState.None,
              uri,
              true
            )
          )
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

      return false
    } catch (error) {
      return false
    }
  }

  private isRuleFile(fileName: string): boolean {
    const ruleExtensions = ['.rule', '.md', '.mdc', '.yml', '.yaml', '.json']
    const extension = path.extname(fileName).toLowerCase()
    return ruleExtensions.includes(extension)
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
