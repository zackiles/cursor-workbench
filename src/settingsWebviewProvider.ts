import * as vscode from 'vscode'
import { logger } from './logger'

let currentPanel: vscode.WebviewPanel | undefined

export function createSettingsWebview(context: vscode.ExtensionContext): void {
  const column = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined

  // If we already have a panel, show it
  if (currentPanel) {
    currentPanel.reveal(column)
    return
  }

  // Otherwise, create a new panel
  const panel = vscode.window.createWebviewPanel(
    'cursorWorkbenchSettings',
    'Cursor Workbench Settings',
    column || vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  )

  currentPanel = panel

  // Set the HTML content
  panel.webview.html = getHtmlForWebview(panel.webview, context)

  // Send initial registry state to webview
  setTimeout(() => {
    try {
      const userRegistry = context.workspaceState.get(
        'cursorWorkBenchUserRegistry'
      )
      const teamRegistry = context.workspaceState.get(
        'cursorWorkBenchTeamRegistry'
      )

      panel.webview.postMessage({
        type: 'registryState',
        data: {
          userRegistry: userRegistry || null,
          teamRegistry: teamRegistry || null
        }
      })
    } catch (error) {
      logger.log('Error sending initial registry state:', error)
    }
  }, 100) // Small delay to ensure webview is ready

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.type) {
        case 'log':
          logger.log(`[Settings Webview] ${message.message}`, message.data)
          return
        case 'openEditorSettings':
          // Open VS Code editor settings
          await vscode.commands.executeCommand('workbench.action.openSettings')
          return
        case 'addRegistry':
          // Handle add registry functionality
          try {
            const registryType = message.registryType as 'user' | 'team'
            const stateKey =
              registryType === 'user'
                ? 'cursorWorkBenchUserRegistry'
                : 'cursorWorkBenchTeamRegistry'
            const displayName = registryType === 'user' ? 'User' : 'Team'

            const registryUrl = await vscode.window.showInputBox({
              prompt: `Enter the URL or file path for the ${displayName} Registry`,
              placeHolder:
                'https://example.com/registry.json or file:///path/to/registry.json',
              validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                  return 'Please enter a valid URL or file path'
                }
                // Basic validation for URL or file path
                if (!value.match(/^(https?:\/\/|file:\/\/\/|\w+:)/)) {
                  return 'Please enter a valid URL (http/https) or file path (file://)'
                }
                return null
              }
            })

            if (registryUrl) {
              // Save to workspace state
              await context.workspaceState.update(stateKey, registryUrl.trim())
              logger.log(`${displayName} registry saved:`, registryUrl)

              // Notify webview of success and send updated state
              panel.webview.postMessage({
                type: 'registryAdded',
                data: {
                  registryType,
                  url: registryUrl.trim()
                }
              })
            } else {
              logger.log(`${displayName} registry addition cancelled by user`)
            }
          } catch (error) {
            logger.log('Error adding registry:', {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            })

            panel.webview.postMessage({
              type: 'registryError',
              data: {
                message:
                  error instanceof Error
                    ? error.message
                    : 'Failed to add registry'
              }
            })
          }
          return
        case 'removeRegistry':
          // Handle remove registry functionality
          try {
            const registryType = message.registryType as 'user' | 'team'
            const stateKey =
              registryType === 'user'
                ? 'cursorWorkBenchUserRegistry'
                : 'cursorWorkBenchTeamRegistry'
            const displayName = registryType === 'user' ? 'User' : 'Team'

            // Remove from workspace state
            await context.workspaceState.update(stateKey, undefined)
            logger.log(`${displayName} registry removed`)

            // Notify webview of removal
            panel.webview.postMessage({
              type: 'registryRemoved',
              data: {
                registryType
              }
            })
          } catch (error) {
            logger.log('Error removing registry:', {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            })

            panel.webview.postMessage({
              type: 'registryError',
              data: {
                message:
                  error instanceof Error
                    ? error.message
                    : 'Failed to remove registry'
              }
            })
          }
          return
        case 'getRegistryState':
          // Send current registry state to webview
          try {
            const userRegistry = context.workspaceState.get(
              'cursorWorkBenchUserRegistry'
            )
            const teamRegistry = context.workspaceState.get(
              'cursorWorkBenchTeamRegistry'
            )

            panel.webview.postMessage({
              type: 'registryState',
              data: {
                userRegistry: userRegistry || null,
                teamRegistry: teamRegistry || null
              }
            })
          } catch (error) {
            logger.log('Error getting registry state:', error)
          }
          return
        case 'getExtensionInfo':
          // Get extension information
          try {
            logger.log('Starting extension info collection...')
            const cursorExtensions = []
            const allExtensions = []

            logger.log(
              `Total extensions found: ${vscode.extensions.all.length}`
            )

            // Filter and collect cursor-related extensions and all extensions
            for (const ext of vscode.extensions.all) {
              try {
                logger.log(`Processing extension: ${ext.id}`)

                const extensionInfo = {
                  id: ext.id,
                  isBuiltin:
                    ext.extensionKind === vscode.ExtensionKind.UI &&
                    ext.extensionPath.includes('app/extensions'),
                  path: ext.extensionPath,
                  exports: Object.keys(ext?.exports ?? {}),
                  packageInfo: ext.packageJSON
                }

                // Add to all extensions
                allExtensions.push(extensionInfo)

                // Filter cursor-related extensions
                if (
                  ext.id.toLowerCase().includes('cursor') ||
                  ext.packageJSON?.displayName?.toLowerCase().includes('cursor')
                ) {
                  logger.log(`Found cursor extension: ${ext.id}`)
                  cursorExtensions.push(extensionInfo)
                }
              } catch (extError) {
                logger.log(`Error processing extension ${ext.id}:`, {
                  message:
                    extError instanceof Error
                      ? extError.message
                      : String(extError),
                  stack: extError instanceof Error ? extError.stack : undefined,
                  extensionId: ext.id,
                  extensionPath: ext.extensionPath
                })
                // Continue processing other extensions
              }
            }

            logger.log(
              `Extension processing complete. Cursor: ${cursorExtensions.length}, Total: ${allExtensions.length}`
            )

            // Send the data back to the webview
            panel.webview.postMessage({
              type: 'extensionInfo',
              data: {
                cursorExtensions,
                allExtensions
              }
            })

            logger.log('Extension info sent to webview successfully')
          } catch (error) {
            logger.log('Error collecting extension info:', {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              name: error instanceof Error ? error.name : 'Unknown',
              errorType: typeof error,
              errorString: String(error),
              vsCodeExtensionsAvailable: !!vscode.extensions,
              vsCodeExtensionsAllAvailable: !!vscode.extensions?.all,
              vsCodeExtensionsAllLength:
                vscode.extensions?.all?.length ?? 'undefined'
            })

            panel.webview.postMessage({
              type: 'extensionInfo',
              data: {
                cursorExtensions: [],
                allExtensions: [],
                error: error instanceof Error ? error.message : String(error)
              }
            })
          }
          return
      }
    },
    null,
    context.subscriptions
  )

  // Reset when the current panel is closed
  panel.onDidDispose(
    () => {
      currentPanel = undefined
    },
    null,
    context.subscriptions
  )
}

function getHtmlForWebview(
  webview: vscode.Webview,
  context: vscode.ExtensionContext
): string {
  const nonce = getNonce()

  // Get the webview bundle URI
  const webviewUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'bin', 'webview.js')
  )

  return `<!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Cursor Workbench Settings</title>
              <style>
                  /* VS Code integration styles with proper theme support */
                  body {
                      font-family: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
                      margin: 0;
                      padding: 0;
                      background: var(--vscode-editor-background);
                      color: var(--vscode-editor-foreground);
                      line-height: 1.5;
                      height: 100vh;
                      overflow: hidden;
                      font-size: 14px;
                  }

                  #root {
                      height: 100vh;
                      width: 100%;
                  }

                  .settings-layout {
                      display: flex;
                      height: 100vh;
                  }

                  /* Sidebar Styles - using same background as main content */
                  .sidebar {
                      width: 240px;
                      background: var(--vscode-editor-background);
                      border-right: 1px solid var(--vscode-panel-border);
                      padding: 24px 0 12px 0;
                      flex-shrink: 0;
                      display: flex;
                      flex-direction: column;
                  }

                  .tab {
                      display: flex;
                      align-items: center;
                      padding: 10px 24px;
                      cursor: pointer;
                      color: var(--vscode-foreground);
                      transition: background-color 0.1s ease, color 0.1s ease;
                      border-radius: 0;
                      margin-bottom: 2px;
                      position: relative;
                      border: none;
                      background: transparent;
                      font-family: inherit;
                      font-size: inherit;
                      text-align: left;
                      width: 100%;
                  }

                  .tab:hover {
                      background: var(--vscode-list-hoverBackground);
                  }

                  .tab.active {
                      background: var(--vscode-list-activeSelectionBackground);
                      color: var(--vscode-list-activeSelectionForeground);
                      font-weight: 500;
                  }

                  .tab.active::before {
                      content: '';
                      position: absolute;
                      left: 0;
                      top: 0;
                      bottom: 0;
                      width: 3px;
                      background: var(--vscode-focusBorder);
                  }

                  .tab-icon {
                      margin-right: 14px;
                      flex-shrink: 0;
                      opacity: 0.8;
                  }

                  .tab.active .tab-icon {
                      opacity: 1;
                  }

                  .tab-label {
                      font-size: 14px;
                      font-weight: 400;
                      letter-spacing: 0.1px;
                  }

                  .separator {
                      height: 1px;
                      background: var(--vscode-panel-border);
                      margin: 16px 24px;
                      opacity: 0.5;
                  }

                  /* Content Styles */
                  .content {
                      flex: 1;
                      overflow-y: auto;
                      background: var(--vscode-editor-background);
                      padding-bottom: 40px;
                  }

                  .tab-content {
                      padding: 32px 40px;
                      height: 100%;
                      box-sizing: border-box;
                  }

                  .content-header {
                      margin-bottom: 32px;
                  }

                  .content-title {
                      font-size: 24px;
                      font-weight: 500;
                      margin: 0;
                      color: var(--vscode-foreground);
                      letter-spacing: -0.2px;
                  }

                  /* Registry Section Styles */
                  .registry-section {
                      max-width: 800px;
                  }

                  .registry-item {
                      background: var(--vscode-editor-background);
                      border: 1px solid var(--vscode-panel-border);
                      border-radius: 8px;
                      padding: 24px 28px;
                      margin-bottom: 24px;
                      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                  }

                  .registry-header-flex {
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                      margin-bottom: 14px;
                      width: 100%;
                  }

                  .registry-title-section {
                      display: flex;
                      align-items: center;
                  }

                  .registry-title {
                      font-size: 18px;
                      font-weight: 500;
                      margin: 0;
                      margin-right: 12px;
                      color: var(--vscode-foreground);
                  }

                  .info-icon {
                      color: var(--vscode-descriptionForeground);
                      opacity: 0.7;
                      cursor: pointer;
                      transition: opacity 0.1s ease;
                  }

                  .info-icon:hover {
                      opacity: 1;
                  }

                  .registry-description {
                      margin: 0 0 16px 0;
                      color: var(--vscode-descriptionForeground);
                      font-size: 14px;
                      line-height: 1.5;
                  }

                  .add-button {
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      gap: 6px;
                      background: var(--vscode-button-secondaryBackground, transparent);
                      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
                      border: 1px solid var(--vscode-button-border);
                      border-radius: 4px;
                      padding: 4px 10px;
                      font-size: 13px;
                      cursor: pointer;
                      font-weight: 500;
                      flex-shrink: 0;
                      height: 28px;
                      min-width: 90px;
                      transition: all 0.15s ease;
                      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                  }

                  .add-button:hover {
                      background: transparent;
                      border-color: var(--vscode-focusBorder);
                      color: var(--vscode-focusBorder);
                  }

                  .add-button:focus {
                      outline: none;
                      box-shadow: 0 0 0 2px var(--vscode-focusBorder);
                  }

                  .button, .open-button {
                      background: var(--vscode-button-background);
                      color: var(--vscode-button-foreground);
                      border: 1px solid var(--vscode-button-border, transparent);
                      border-radius: 4px;
                      padding: 6px 14px;
                      font-size: 14px;
                      cursor: pointer;
                      font-weight: 500;
                      height: 32px;
                      min-width: 80px;
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      transition: all 0.15s ease;
                      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                  }

                  .button {
                      margin-right: 10px;
                      height: 36px;
                  }

                  .button:hover, .open-button:hover {
                      background: var(--vscode-button-hoverBackground);
                      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                  }

                  .button:focus, .open-button:focus {
                      outline: none;
                      box-shadow: 0 0 0 2px var(--vscode-focusBorder);
                  }

                  .placeholder-text {
                      text-align: center;
                      color: var(--vscode-descriptionForeground);
                      font-style: italic;
                      margin: 40px 0;
                      font-size: 14px;
                  }

                  /* Preferences Section */
                  .preferences-section {
                      margin-top: 32px;
                  }

                  .preferences-heading {
                      font-size: 20px;
                      font-weight: 500;
                      color: var(--vscode-foreground);
                      margin: 0 0 16px 0;
                      padding-bottom: 8px;
                      border-bottom: 1px solid var(--vscode-panel-border);
                      opacity: 0.9;
                  }

                  /* Editor Settings Item */
                  .editor-settings-item {
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      padding: 16px 0;
                      border-bottom: 1px solid var(--vscode-panel-border);
                      opacity: 0.8;
                  }

                  .editor-settings-item:last-child {
                      border-bottom: none;
                  }

                  .editor-settings-info {
                      flex: 1;
                  }

                  .editor-settings-title {
                      font-size: 16px;
                      font-weight: 500;
                      margin: 0 0 6px 0;
                      color: var(--vscode-foreground);
                  }

                  .editor-settings-description {
                      color: var(--vscode-descriptionForeground);
                      font-size: 14px;
                      margin: 0;
                      line-height: 1.5;
                  }

                  .editor-settings-action {
                      flex-shrink: 0;
                      margin-left: 24px;
                  }
              </style>
          </head>
          <body>
              <div id="root"></div>
              <script nonce="${nonce}">
                  window.WEBVIEW_TYPE = 'settings';
              </script>
              <script nonce="${nonce}" src="${webviewUri}"></script>
          </body>
          </html>`
}

function getNonce(): string {
  let text = ''
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
