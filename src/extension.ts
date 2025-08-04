import * as vscode from 'vscode'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { configManager } from './common/configManager'
import { fileDecorationProvider } from './common/fileDecorationProvider'
import { logger } from './common/logger'
import { registryManager } from './common/registryManager'
import { RuleEditorProvider } from './editor/RuleEditorProvider'
import { CursorFileSystemProvider } from './explorer/CursorFileSystemProvider'
import { RulesTreeProvider } from './explorer/RulesTreeProvider'
import {
  createSettingsWebview,
  getHtmlForWebview,
  refreshSettingsWebview
} from './settings/SettingsProvider'

// Copy latest build artifacts from source to target directory
function copyLatestBuild(sourceDir: string, targetDir: string) {
  try {
    const sourceBinDir = path.join(sourceDir, 'bin')
    const targetBinDir = path.join(targetDir, 'bin')

    // Ensure target bin directory exists
    if (!fs.existsSync(targetBinDir)) {
      fs.mkdirSync(targetBinDir, { recursive: true })
    }

    // Copy build artifacts if they exist
    const filesToCopy = ['extension.js', 'webview.js', 'webview.css']

    for (const file of filesToCopy) {
      const sourcePath = path.join(sourceBinDir, file)
      const targetPath = path.join(targetBinDir, file)

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath)
      }
    }

    logger.log('Latest build artifacts copied to extension directory')
  } catch (error) {
    logger.log('Failed to copy latest build artifacts:', error)
  }
}

async function openTestRuleIfNeeded(
  context: vscode.ExtensionContext
): Promise<void> {
  const testRulePath = '.cursor/rules/test.mdc'
  const testRuleUri = vscode.Uri.joinPath(
    vscode.workspace.workspaceFolders?.[0]?.uri || context.extensionUri,
    testRulePath
  )

  let isTestRuleOpen = false

  try {
    if (vscode.window.tabGroups?.all) {
      isTestRuleOpen = vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .some(
          (tab) =>
            tab.input instanceof vscode.TabInputText &&
            tab.input.uri.fsPath === testRuleUri.fsPath
        )
    } else {
      isTestRuleOpen = vscode.window.visibleTextEditors.some(
        (editor) => editor.document.uri.fsPath === testRuleUri.fsPath
      )
    }
  } catch (error) {
    logger.log(`Error checking if ${testRulePath} is open:`, error)
    isTestRuleOpen = false
  }

  if (!isTestRuleOpen) {
    try {
      await vscode.commands.executeCommand('vscode.open', testRuleUri)
      logger.log(`Opened ${testRulePath} file`)
    } catch (error) {
      logger.log(`Error opening ${testRulePath} file:`, error)
    }
  } else {
    logger.log(`${testRulePath} file is already open`)
  }
}

export async function activate(context: vscode.ExtensionContext) {
  const env = process.env.NODE_ENV || 'production'
  const buildTime = process.env.BUILD_TIME || 'unknown'
  const buildDate =
    buildTime !== 'unknown' ? new Date(buildTime).toLocaleString() : 'unknown'

  logger.log('Activating Cursor Workbench extension')
  logger.log(`Environment: ${env}`)
  logger.log(`Last built: ${buildDate}`)

  // TODO: Implement our own rule creation override with the custom rule editor
  /**
  vscode.commands.registerCommand('workbench.action.newCursorRule', () => {
    logger.log('TRIGGERED: New Cursor Rule')
  })
  /** */

  await configManager.initialize(context)
  await registryManager.initialize(context)

  // Register the custom editor provider
  const providerRegistration = RuleEditorProvider.register(context)
  context.subscriptions.push(providerRegistration)

  // Force our custom editor to be the default for .rule and .mdc files
  const editorAssociations =
    vscode.workspace.getConfiguration('workbench').get('editorAssociations') ||
    {}
  const updatedAssociations = {
    ...editorAssociations,
    '*.rule': 'customFileEditor',
    '*.mdc': 'customFileEditor'
  }

  try {
    await vscode.workspace
      .getConfiguration('workbench')
      .update(
        'editorAssociations',
        updatedAssociations,
        vscode.ConfigurationTarget.Global
      )
    logger.log(
      'Set editor associations for .rule and .mdc files to use custom editor'
    )
  } catch (error) {
    logger.log('Failed to set editor associations:', error)
  }

  // Mark as default editor on first installation only
  if (configManager.isFirstInstallation()) {
    logger.log(
      'First installation detected - custom editor will be used for configured extensions'
    )
    await configManager.setIsDefaultRuleEditor(true)
  }

  if (env === 'development') {
    // Use PROJECT_SOURCE_DIR environment variable if available (for dev script)
    // Otherwise fall back to extension path for regular development
    const sourceDir = process.env.PROJECT_SOURCE_DIR || context.extensionPath
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(sourceDir, 'bin/**/*.js')
    )

    watcher.onDidChange(() => {
      logger.log('Extension files changed. Reloading window...')
      // If using dev script, copy latest build from source to extension directory
      if (process.env.PROJECT_SOURCE_DIR) {
        copyLatestBuild(sourceDir, context.extensionPath)
      }
      vscode.commands.executeCommand('workbench.action.reloadWindow')
    })

    context.subscriptions.push(watcher)

    logger.log(
      'Development mode: auto-opening settings webview and .cursor/rules/test.mdc'
    )

    createSettingsWebview(context)
    void openTestRuleIfNeeded(context)

    setTimeout(() => {
      logger.log('Opening Developer Tools in development mode')
      logger.show()
      vscode.commands.executeCommand(
        'workbench.action.webview.openDeveloperTools'
      )
    }, 1000)
  }

  const fileSystemProvider = new CursorFileSystemProvider()
  const fileSystemRegistration = vscode.workspace.registerFileSystemProvider(
    'cursorfs',
    fileSystemProvider,
    {
      isCaseSensitive: true
    }
  )
  context.subscriptions.push(fileSystemRegistration)

  const decorationRegistration = vscode.window.registerFileDecorationProvider(
    fileDecorationProvider
  )
  context.subscriptions.push(decorationRegistration)

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  const rulesProvider = new RulesTreeProvider(workspaceRoot)
  const treeView = vscode.window.createTreeView('rulesExplorer', {
    treeDataProvider: rulesProvider,
    showCollapseAll: true
  })

  treeView.onDidChangeVisibility(() => {
    if (treeView.visible) {
      rulesProvider.refresh()
    }
  })

  context.subscriptions.push(treeView)

  rulesProvider.refresh()

  const refreshCommand = vscode.commands.registerCommand(
    'cursorWorkbench.rules.refresh',
    () => {
      logger.log('Refreshing rules explorer')
      rulesProvider.refresh()
    }
  )

  const settingsCommand = vscode.commands.registerCommand(
    'cursorWorkbench.rules.settings',
    async () => {
      logger.log('Opening settings')
      createSettingsWebview(context)
    }
  )

  const syncFileCommand = vscode.commands.registerCommand(
    'cursorWorkbench.rules.syncFile',
    async (item) => {
      logger.log('Syncing file')
      await rulesProvider.syncFile(item)
    }
  )

  const refreshSettingsCommand = vscode.commands.registerCommand(
    'cursorWorkbench.rules.refreshSettings',
    () => {
      logger.log('Manually refreshing settings webview')
      refreshSettingsWebview(context)
      vscode.window.showInformationMessage('Settings view refreshed')
    }
  )

  const toggleCustomEditorCommand = vscode.commands.registerCommand(
    'cursorWorkbench.toggleCustomEditor',
    async (enabled: boolean) => {
      logger.log('Toggling custom editor via command:', enabled)
      await configManager.setIsDefaultRuleEditor(enabled)

      if (enabled) {
        vscode.window.showInformationMessage(
          'Custom editor enabled. VS Code will use the Rule Editor for .rule and .mdc files.'
        )
      } else {
        vscode.window.showInformationMessage(
          'Custom editor disabled. VS Code will use the default text editor for .rule and .mdc files.'
        )
      }
    }
  )

  context.subscriptions.push(
    refreshCommand,
    settingsCommand,
    syncFileCommand,
    refreshSettingsCommand,
    toggleCustomEditorCommand
  )

  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer('cursorWorkbenchSettings', {
      async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
        // Re-initialize the webview content and hooks
        createSettingsWebview(context, webviewPanel)
      }
    })
  )

 
}

export function deactivate() {}
