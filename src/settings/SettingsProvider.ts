import * as vscode from 'vscode'
import { configManager } from '../common/configManager'
import { logger } from '../common/logger'
import { registryManager } from '../common/registryManager'
import { getNonce } from '../common/utils'

function convertGithubUrlToGit(url: string): string {
  const githubHttpsRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)(\.git)?$/
  const match = url.match(githubHttpsRegex)

  if (match) {
    const [, owner, repo] = match
    const repoName = repo.endsWith('.git') ? repo.slice(0, -4) : repo
    return `git@github.com:${owner}/${repoName}.git`
  }

  return url
}

export let currentPanel: vscode.WebviewPanel | undefined

export function refreshSettingsWebview(context: vscode.ExtensionContext): void {
  if (currentPanel) {
    logger.log('Refreshing existing settings webview')
    currentPanel.webview.html = getHtmlForWebview(currentPanel.webview, context)

    currentPanel.webview.postMessage({
      type: 'refresh',
      timestamp: Date.now()
    })

    return
  }

  logger.log('No settings webview to refresh, creating new one')
  createSettingsWebview(context)
}

export function createSettingsWebview(context: vscode.ExtensionContext): void {
  const column = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined

  // If we already have a panel, show it
  if (currentPanel) {
    currentPanel.reveal(column)
    // Always refresh the HTML content to ensure latest CSS
    currentPanel.webview.html = getHtmlForWebview(currentPanel.webview, context)
    return
  }

  // Otherwise, create a new panel
  const panel = vscode.window.createWebviewPanel(
    'cursorWorkbenchSettings',
    'Cursor Workbench Settings',
    column || vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'bin')],
      retainContextWhenHidden: false // Set to false to ensure panel is fully recreated
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
      const teamRegistryFromManager = registryManager.getTeamRegistry()

      panel.webview.postMessage({
        type: 'settingsState',
        data: {
          userRegistry: userRegistry || null,
          teamRegistry: teamRegistryFromManager?.url || null,
          userRegistryFileCount: userRegistry ? 0 : undefined, // TODO: Implement user registry file counting
          teamRegistryFileCount:
            teamRegistryFromManager?.files.length || undefined,
          editorSettings: configManager.getSettings()
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
            const displayName = registryType === 'user' ? 'User' : 'Team'

            const registryUrl = await vscode.window.showInputBox({
              prompt: `Enter the ${registryType === 'team' ? 'Git repository URL' : 'URL or file path'} for the ${displayName} Registry`,
              placeHolder:
                registryType === 'team'
                  ? 'git@github.com:user/repo.git or https://github.com/user/repo.git'
                  : 'https://example.com/registry.json or file:///path/to/registry.json',
              validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                  return `Please enter a valid ${registryType === 'team' ? 'Git repository URL' : 'URL or file path'}`
                }

                if (registryType === 'team') {
                  // Validate git URL formats
                  if (
                    !value.match(
                      /^(git@|https:\/\/github\.com\/[^\/]+\/[^\/]+|.*\.git$)/
                    )
                  ) {
                    return 'Please enter a valid Git repository URL (git@... or https://github.com/owner/repo)'
                  }
                } else {
                  // Basic validation for URL or file path
                  if (!value.match(/^(https?:\/\/|file:\/\/\/|\w+:)/)) {
                    return 'Please enter a valid URL (http/https) or file path (file://)'
                  }
                }
                return null
              }
            })

            if (registryUrl) {
              const trimmedUrl = registryUrl.trim()

              // Convert HTTPS GitHub URLs to Git URLs if it's a team registry
              const convertedUrl =
                registryType === 'team'
                  ? convertGithubUrlToGit(trimmedUrl)
                  : trimmedUrl

              if (registryType === 'team') {
                // Use registry manager for team registries
                await registryManager.addTeamRegistry(convertedUrl)
                const logMessage =
                  convertedUrl !== trimmedUrl
                    ? `${displayName} registry added via registry manager: ${convertedUrl} (converted from ${trimmedUrl})`
                    : `${displayName} registry added via registry manager: ${convertedUrl}`
                logger.log(logMessage)
              } else {
                // Save user registry to workspace state
                const stateKey = 'cursorWorkBenchUserRegistry'
                await context.workspaceState.update(stateKey, trimmedUrl)
                logger.log(
                  `${displayName} registry saved to workspace state:`,
                  trimmedUrl
                )
              }

              // Get the file count for the registry
              const fileCount =
                registryType === 'team'
                  ? registryManager.getTeamRegistry()?.files.length || 0
                  : 0 // TODO: Implement user registry file counting

              // Notify webview of success and send updated state with file count
              panel.webview.postMessage({
                type: 'registryAdded',
                data: {
                  registryType,
                  url: registryType === 'team' ? convertedUrl : trimmedUrl,
                  fileCount
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
            const displayName = registryType === 'user' ? 'User' : 'Team'

            if (registryType === 'team') {
              // Use registry manager for team registries
              await registryManager.removeTeamRegistry()
              logger.log(`${displayName} registry removed via registry manager`)
            } else {
              // Remove user registry from workspace state
              const stateKey = 'cursorWorkBenchUserRegistry'
              await context.workspaceState.update(stateKey, undefined)
              logger.log(`${displayName} registry removed from workspace state`)
            }

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
        case 'getSettingsState':
          // Send current settings state to webview
          try {
            const userRegistry = context.workspaceState.get(
              'cursorWorkBenchUserRegistry'
            )
            const teamRegistryFromManager = registryManager.getTeamRegistry()

            panel.webview.postMessage({
              type: 'settingsState',
              data: {
                userRegistry: userRegistry || null,
                teamRegistry: teamRegistryFromManager?.url || null,
                userRegistryFileCount: userRegistry ? 0 : undefined, // TODO: Implement user registry file counting
                teamRegistryFileCount:
                  teamRegistryFromManager?.files.length || undefined,
                editorSettings: configManager.getSettings()
              }
            })
          } catch (error) {
            logger.log('Error getting settings state:', error)
          }
          return
        case 'toggleEditor':
          // Handle toggle editor functionality
          try {
            const enabled = message.enabled as boolean
            logger.log('Toggling editor enabled state:', enabled)

            // Use the new command to enable/disable the custom editor
            await vscode.commands.executeCommand(
              'cursorWorkbench.toggleCustomEditor',
              enabled
            )

            // Send updated settings state
            panel.webview.postMessage({
              type: 'settingsState',
              data: {
                userRegistry:
                  context.workspaceState.get('cursorWorkBenchUserRegistry') ||
                  null,
                teamRegistry: registryManager.getTeamRegistry()?.url || null,
                userRegistryFileCount: undefined,
                teamRegistryFileCount:
                  registryManager.getTeamRegistry()?.files.length || undefined,
                editorSettings: configManager.getSettings()
              }
            })
          } catch (error) {
            logger.log('Error toggling editor:', error)
          }
          return
        case 'updateExtensions':
          // Handle update extensions functionality
          try {
            const extensions = message.extensions as string[]
            logger.log('Updating enabled extensions:', extensions)

            await configManager.setEnabledExtensions(extensions)

            // Send updated settings state
            panel.webview.postMessage({
              type: 'settingsState',
              data: {
                userRegistry:
                  context.workspaceState.get('cursorWorkBenchUserRegistry') ||
                  null,
                teamRegistry: registryManager.getTeamRegistry()?.url || null,
                userRegistryFileCount: undefined,
                teamRegistryFileCount:
                  registryManager.getTeamRegistry()?.files.length || undefined,
                editorSettings: configManager.getSettings()
              }
            })
          } catch (error) {
            logger.log('Error updating extensions:', error)
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
      // Clean up panel resources and clear reference
      currentPanel = undefined

      // Force garbage collection
      if (global.gc) {
        try {
          global.gc()
        } catch (e) {
          logger.log('Failed to force garbage collection', e)
        }
      }

      // Log panel disposal for debugging
      logger.log('Settings panel disposed')
    },
    null,
    context.subscriptions
  )
}

export function getHtmlForWebview(
  webview: vscode.Webview,
  context: vscode.ExtensionContext
): string {
  const nonce = getNonce()
  const timestamp = Date.now()

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
              <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Cursor Workbench Settings</title>
              <link href="${stylesUri}?v=${timestamp}&cache=false" rel="stylesheet">
          </head>
          <body>
              <div id="root"></div>
              <script nonce="${nonce}">
                  window.WEBVIEW_TYPE = 'settings';
                  console.log('Loading CSS from: ${stylesUri}?v=${timestamp}');
                  window.DEV_RELOAD = function() {
                      console.log('🔄 Reloading CSS...');
                      const links = document.querySelectorAll('link[rel="stylesheet"]');
                      links.forEach(link => {
                          const href = link.href.split('?')[0];
                          link.href = href + '?v=' + Date.now() + '&cache=false';
                      });
                  };
              </script>
              <script nonce="${nonce}" src="${webviewUri}?v=${timestamp}"></script>
          </body>
          </html>`
}
