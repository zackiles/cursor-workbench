import * as vscode from 'vscode'
import { RuleEditorProvider } from './editor/RuleEditorProvider'
import { RulesTreeProvider } from './explorer/RulesTreeProvider'
import { CursorFileSystemProvider } from './explorer/CursorFileSystemProvider'
import { registryManager } from './common/registryManager'
import { fileDecorationProvider } from './common/fileDecorationProvider'
import { configManager } from './common/configManager'
import {
  createSettingsWebview,
  refreshSettingsWebview,
  getHtmlForWebview
} from './settings/SettingsProvider'
import { logger } from './common/logger'

async function registerAsDefaultEditor(): Promise<void> {
  const extensions = configManager.getEnabledExtensions()

  for (const ext of extensions) {
    const selector = `*${ext}`
    try {
      await vscode.commands.executeCommand(
        'workbench.action.setDefaultEditor',
        selector,
        'customFileEditor'
      )
      logger.log(`Registered as default editor for ${ext}`)
    } catch (error) {
      logger.log(`Failed to register as default editor for ${ext}:`, error)
    }
  }

  await configManager.setIsDefaultRuleEditor(true)
}

async function unregisterAsDefaultEditor(): Promise<void> {
  const extensions = configManager.getEnabledExtensions()

  for (const ext of extensions) {
    const selector = `*${ext}`
    try {
      await vscode.commands.executeCommand(
        'workbench.action.resetDefaultEditor',
        selector
      )
      logger.log(`Reset default editor for ${ext}`)
    } catch (error) {
      logger.log(`Failed to reset default editor for ${ext}:`, error)
    }
  }

  await configManager.setIsDefaultRuleEditor(false)
  logger.log('Unregistered as default rule editor')
}

async function openTestRuleIfNeeded(
  context: vscode.ExtensionContext
): Promise<void> {
  const testRuleUri = vscode.Uri.joinPath(
    vscode.workspace.workspaceFolders?.[0]?.uri || context.extensionUri,
    'test.rule'
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
    logger.log('Error checking if test.rule is open:', error)
    isTestRuleOpen = false
  }

  if (!isTestRuleOpen) {
    try {
      await vscode.commands.executeCommand('vscode.open', testRuleUri)
      logger.log('Opened test.rule file')
    } catch (error) {
      logger.log('Error opening test.rule file:', error)
    }
  } else {
    logger.log('test.rule file is already open')
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

  await configManager.initialize(context)
  await registryManager.initialize(context)

  const providerRegistration = RuleEditorProvider.register(context)
  context.subscriptions.push(providerRegistration)

  const isDefaultRuleEditor = configManager.getSettings().isDefaultRuleEditor

  if (isDefaultRuleEditor) {
    await registerAsDefaultEditor()
  } else if (configManager.isFirstInstallation()) {
    logger.log(
      'First installation detected - enabling custom editor for configured extensions'
    )
    await registerAsDefaultEditor()
  }

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

    logger.log('Development mode: auto-opening settings webview and test.rule')

    createSettingsWebview(context)
    void openTestRuleIfNeeded(context)

    setTimeout(() => {
      logger.log('Opening Developer Tools in development mode')
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
  vscode.window.registerTreeDataProvider('rulesExplorer', rulesProvider)

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

  const refreshSettingsCommand = vscode.commands.registerCommand(
    'rulesExplorer.refreshSettings',
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
      if (enabled) {
        await registerAsDefaultEditor()
      } else {
        await unregisterAsDefaultEditor()
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
        webviewPanel.webview.options = {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'bin')]
        }

        webviewPanel.webview.html = getHtmlForWebview(
          webviewPanel.webview,
          context
        )
      }
    })
  )

  logger.show()
}

export function deactivate() {}
