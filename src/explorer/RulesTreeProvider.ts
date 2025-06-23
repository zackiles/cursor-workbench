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
    public readonly registryType?: 'team' | 'user' | 'local',
    public readonly itemType?:
      | 'localRoot'
      | 'teamRoot'
      | 'addRegistry'
      | 'folder'
      | 'file'
  ) {
    super(label, collapsibleState)

    if (itemType === 'addRegistry') {
      this.command = {
        command: 'rulesExplorer.settings',
        title: 'Add Registry'
      }
      this.contextValue = 'addRegistry'
      return
    }

    if (itemType === 'localRoot') {
      this.contextValue = 'localRoot'
      this.iconPath = new vscode.ThemeIcon('device-desktop')
      return
    }

    if (itemType === 'teamRoot') {
      this.contextValue = 'teamRoot'
      this.iconPath = new vscode.ThemeIcon(
        'organization',
        new vscode.ThemeColor('testing.iconPassed')
      )
      return
    }

    if (isFile && resourceUri) {
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [resourceUri]
      }

      if (registryType === 'team') {
        this.contextValue = 'virtualRuleFile'
        this.iconPath = new vscode.ThemeIcon('pencil')
      } else if (registryType === 'user') {
        this.contextValue = 'virtualRuleFile'
        this.iconPath = new vscode.ThemeIcon('pencil')
      } else {
        this.contextValue = 'ruleFile'
        this.iconPath = new vscode.ThemeIcon('pencil')
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

    if (!element) {
      return this.getRootItems()
    }

    if (element.itemType === 'localRoot') {
      return this.getLocalRulesChildren()
    }

    if (element.itemType === 'teamRoot') {
      return this.getTeamRulesChildren()
    }

    if (element.resourceUri && !element.isFile) {
      const regType = element.registryType === 'team' ? 'team' : 'local'
      return this.getDirectoryContents(element.resourceUri.fsPath, regType)
    }

    return Promise.resolve([])
  }

  private async getRootItems(): Promise<RulesTreeItem[]> {
    const items: RulesTreeItem[] = []

    const hasLocalRules = await this.hasLocalRules()
    if (hasLocalRules) {
      items.push(
        new RulesTreeItem(
          'Local Rules',
          vscode.TreeItemCollapsibleState.Expanded,
          undefined,
          false,
          'local',
          'localRoot'
        )
      )
    }

    const teamRegistry = registryManager.getTeamRegistry()
    if (teamRegistry && teamRegistry.files.length > 0) {
      items.push(
        new RulesTreeItem(
          '𝗧𝗲𝗮𝗺 𝗥𝘂𝗹𝗲𝘀',
          vscode.TreeItemCollapsibleState.Expanded,
          undefined,
          false,
          'team',
          'teamRoot'
        )
      )
    } else if (!teamRegistry) {
      items.push(
        new RulesTreeItem(
          '+ Add Registry',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          false,
          undefined,
          'addRegistry'
        )
      )
    }

    return items
  }

  private async hasLocalRules(): Promise<boolean> {
    if (!this.workspaceRoot) return false
    const rulesPath = path.join(this.workspaceRoot, '.cursor', 'rules')

    try {
      if (!fs.existsSync(rulesPath)) {
        return false
      }

      const entries = await fs.promises.readdir(rulesPath, {
        withFileTypes: true
      })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const hasNested = await this.hasRuleFiles(
            path.join(rulesPath, entry.name)
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

  private async getLocalRulesChildren(): Promise<RulesTreeItem[]> {
    if (!this.workspaceRoot) return []
    const rulesPath = path.join(this.workspaceRoot, '.cursor', 'rules')

    try {
      const items: RulesTreeItem[] = []

      if (!fs.existsSync(rulesPath)) {
        return items
      }

      const entries = await fs.promises.readdir(rulesPath, {
        withFileTypes: true
      })

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
              false,
              'local',
              'folder'
            )
          )
        } else if (this.isRuleFile(entry.name)) {
          items.push(
            new RulesTreeItem(
              entry.name,
              vscode.TreeItemCollapsibleState.None,
              uri,
              true,
              'local',
              'file'
            )
          )
        }
      }

      return items
    } catch (error) {
      logger.log('Error reading local rules', error)
      return []
    }
  }

  private async getTeamRulesChildren(): Promise<RulesTreeItem[]> {
    const teamRegistry = registryManager.getTeamRegistry()
    if (!teamRegistry || !this.workspaceRoot) {
      return []
    }

    const items: RulesTreeItem[] = []
    const folders = new Set<string>()
    const files: string[] = []

    for (const virtualFile of teamRegistry.files) {
      const normalizedPath = virtualFile.replace(/\\/g, '/')
      let relativePath = normalizedPath

      if (normalizedPath.startsWith('.cursor/rules/')) {
        relativePath = normalizedPath.substring('.cursor/rules/'.length)
      }

      const segments = relativePath.split('/')

      if (segments.length > 1) {
        folders.add(segments[0])
      } else {
        files.push(relativePath)
      }
    }

    const sortedFolders = Array.from(folders).sort()
    for (const folderName of sortedFolders) {
      const virtualPath = path.join(
        this.workspaceRoot,
        '.cursor',
        'rules',
        folderName
      )
      const cursorfsUri = vscode.Uri.parse(`cursorfs:${virtualPath}`)

      items.push(
        new RulesTreeItem(
          folderName,
          vscode.TreeItemCollapsibleState.Collapsed,
          cursorfsUri,
          false,
          'team',
          'folder'
        )
      )
    }

    for (const fileName of files.sort()) {
      const virtualPath = path.join(
        this.workspaceRoot,
        '.cursor',
        'rules',
        fileName
      )
      const cursorfsUri = vscode.Uri.parse(`cursorfs:${virtualPath}`)

      const virtualItem = new RulesTreeItem(
        fileName,
        vscode.TreeItemCollapsibleState.None,
        cursorfsUri,
        true,
        'team',
        'file'
      )

      virtualItem.tooltip = `Virtual file from team registry: ${fileName}`
      items.push(virtualItem)
    }

    return items
  }

  private async getDirectoryContents(
    dirPath: string,
    registryType: 'local' | 'team'
  ): Promise<RulesTreeItem[]> {
    if (registryType === 'team') {
      return this.getTeamDirectoryContents(dirPath)
    }

    try {
      const items: RulesTreeItem[] = []

      if (!fs.existsSync(dirPath)) {
        return items
      }

      const entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true
      })

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
              'local',
              'folder'
            )
          )
        } else if (this.isRuleFile(entry.name)) {
          items.push(
            new RulesTreeItem(
              entry.name,
              vscode.TreeItemCollapsibleState.None,
              uri,
              true,
              'local',
              'file'
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

  private async getTeamDirectoryContents(
    dirPath: string
  ): Promise<RulesTreeItem[]> {
    const teamRegistry = registryManager.getTeamRegistry()
    if (!teamRegistry || !this.workspaceRoot) {
      return []
    }

    const items: RulesTreeItem[] = []
    const relativePath = path
      .relative(path.join(this.workspaceRoot, '.cursor', 'rules'), dirPath)
      .replace(/\\/g, '/')
    const folders = new Set<string>()
    const files: string[] = []

    for (const virtualFile of teamRegistry.files) {
      const normalizedPath = virtualFile.replace(/\\/g, '/')

      // Strip .cursor/rules/ prefix to get relative path
      let fileRelativePath = normalizedPath
      if (normalizedPath.startsWith('.cursor/rules/')) {
        fileRelativePath = normalizedPath.substring('.cursor/rules/'.length)
      }

      if (fileRelativePath.startsWith(`${relativePath}/`)) {
        const remainingPath = fileRelativePath.substring(
          relativePath.length + 1
        )
        const segments = remainingPath.split('/')

        if (segments.length > 1) {
          folders.add(segments[0])
        } else {
          files.push(remainingPath)
        }
      }
    }

    const sortedFolders = Array.from(folders).sort()
    for (const folderName of sortedFolders) {
      const virtualPath = path.join(dirPath, folderName)
      const cursorfsUri = vscode.Uri.parse(`cursorfs:${virtualPath}`)

      items.push(
        new RulesTreeItem(
          folderName,
          vscode.TreeItemCollapsibleState.Collapsed,
          cursorfsUri,
          false,
          'team',
          'folder'
        )
      )
    }

    for (const fileName of files.sort()) {
      const virtualPath = path.join(dirPath, fileName)
      const cursorfsUri = vscode.Uri.parse(`cursorfs:${virtualPath}`)

      const virtualItem = new RulesTreeItem(
        fileName,
        vscode.TreeItemCollapsibleState.None,
        cursorfsUri,
        true,
        'team',
        'file'
      )

      virtualItem.tooltip = `Virtual file from team registry: ${path.join(relativePath, fileName)}`
      items.push(virtualItem)
    }

    return items
  }

  private async hasRuleFiles(dirPath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(dirPath)) {
        return false
      }

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
    return configManager.isRuleFile(fileName)
  }

  async syncFile(item: RulesTreeItem): Promise<void> {
    if (!item.resourceUri) {
      vscode.window.showErrorMessage('No file selected for sync')
      return
    }

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
