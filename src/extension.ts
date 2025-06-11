import * as vscode from 'vscode'
import { RuleEditorProvider } from './editor/RuleEditorProvider'
import { RulesTreeProvider } from './explorer/RulesTreeProvider'
import {
  createSettingsWebview,
  refreshSettingsWebview
} from './settings/SettingsProvider'
import { logger } from './common/logger'

// Helper function to open test.rule file if not already open
async function openTestRuleIfNeeded(
  context: vscode.ExtensionContext
): Promise<void> {
  const testRuleUri = vscode.Uri.joinPath(
    vscode.workspace.workspaceFolders?.[0]?.uri || context.extensionUri,
    'test.rule'
  )

  // Check if test.rule is already open
  let isTestRuleOpen = false

  try {
    // First check if the API exists (tabGroups is only available in newer VS Code versions)
    if (vscode.window.tabGroups?.all) {
      isTestRuleOpen = vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .some(
          (tab) =>
            tab.input instanceof vscode.TabInputText &&
            tab.input.uri.fsPath === testRuleUri.fsPath
        )
    } else {
      // Fall back to checking active text editors (less reliable but works in older versions)
      isTestRuleOpen = vscode.window.visibleTextEditors.some(
        (editor) => editor.document.uri.fsPath === testRuleUri.fsPath
      )
    }
  } catch (error) {
    logger.log('Error checking if test.rule is open:', error)
    // Default to false on error - we'll try to open it
    isTestRuleOpen = false
  }

  if (!isTestRuleOpen) {
    try {
      // Open the test.rule file in a new editor
      await vscode.commands.executeCommand('vscode.open', testRuleUri)
      logger.log('Opened test.rule file')
    } catch (error) {
      logger.log('Error opening test.rule file:', error)
    }
  } else {
    logger.log('test.rule file is already open')
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Print environment and build info
  const env = process.env.NODE_ENV || 'production'
  const buildTime = process.env.BUILD_TIME || 'unknown'
  const buildDate =
    buildTime !== 'unknown' ? new Date(buildTime).toLocaleString() : 'unknown'

  logger.log('Activating Cursor Workbench extension')
  logger.log(`Environment: ${env}`)
  logger.log(`Last built: ${buildDate}`)

  // Development mode: watch for extension changes and auto-reload
  if (env === 'development') {
    const extensionPath = context.extensionPath
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(extensionPath, 'bin/**/*.js')
    )

    watcher.onDidChange(() => {
      logger.log('Extension files changed. Reloading window...')
      vscode.commands.executeCommand('workbench.action.reloadWindow')
    })

    context.subscriptions.push(watcher)

    // Auto-open settings webview and test.rule in development mode
    logger.log('Development mode: auto-opening settings webview and test.rule')

    // First open settings webview
    createSettingsWebview(context)

    // Then open test.rule if it's not already open
    void openTestRuleIfNeeded(context)
  }

  // Register the custom text editor provider for custom files
  const providerRegistration = RuleEditorProvider.register(context)
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

      // Also open test.rule if it's not already open
      await openTestRuleIfNeeded(context)
    }
  )

  const syncFileCommand = vscode.commands.registerCommand(
    'rulesExplorer.syncFile',
    async (item) => {
      logger.log('Syncing file')
      await rulesProvider.syncFile(item)
    }
  )

  // Command to manually refresh the settings webview (helpful for development)
  const refreshSettingsCommand = vscode.commands.registerCommand(
    'rulesExplorer.refreshSettings',
    () => {
      logger.log('Manually refreshing settings webview')
      refreshSettingsWebview(context)
      vscode.window.showInformationMessage('Settings view refreshed')
    }
  )

  context.subscriptions.push(
    refreshCommand,
    settingsCommand,
    syncFileCommand,
    refreshSettingsCommand
  )

  // Show the output channel
  logger.show()
}

export function deactivate() {
  // Extension cleanup
}
