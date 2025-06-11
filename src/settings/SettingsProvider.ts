import * as vscode from 'vscode'
import { logger } from '../common/logger'
import { getNonce } from '../common/utils'

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
  const stylesUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'bin', 'webview.css')
  )

  return `<!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource};">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Cursor Workbench Settings</title>
              <link href="${stylesUri}" rel="stylesheet">
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
