import * as vscode from 'vscode'
import { CustomFileEditorProvider } from './customFileEditorProvider'
import { RulesTreeProvider } from './rulesTreeProvider'
import { createSettingsWebview } from './settingsWebviewProvider'
import { logger } from './logger'

export function activate(context: vscode.ExtensionContext) {
  logger.log('Activating Cursor Workbench extension')

  // Register the custom text editor provider for custom files
  const providerRegistration = CustomFileEditorProvider.register(context)
  context.subscriptions.push(providerRegistration)

  // Get workspace root
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

  // Register the rules tree data provider
  const rulesProvider = new RulesTreeProvider(workspaceRoot)
  vscode.window.registerTreeDataProvider('rulesExplorer', rulesProvider)

  // Register commands
  const refreshCommand = vscode.commands.registerCommand(
    'rulesExplorer.refresh',
    () => {
      logger.log('Refreshing rules explorer')
      rulesProvider.refresh()
    }
  )

  const settingsCommand = vscode.commands.registerCommand(
    'rulesExplorer.settings',
    async () => {
      logger.log('Opening settings')
      createSettingsWebview(context)
    }
  )

  const syncFileCommand = vscode.commands.registerCommand(
    'rulesExplorer.syncFile',
    async (item) => {
      logger.log('Syncing file')
      await rulesProvider.syncFile(item)
    }
  )

  context.subscriptions.push(refreshCommand, settingsCommand, syncFileCommand)

  // Show the output channel
  logger.show()
}

export function deactivate() {
  // Extension cleanup
}
