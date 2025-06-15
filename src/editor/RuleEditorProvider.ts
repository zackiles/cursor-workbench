import * as vscode from 'vscode'
import * as path from 'node:path'
import { RuleDocument } from './RuleDocument'
import { logger } from '../common/logger'
import { getNonce } from '../common/utils'
import { createSettingsWebview } from '../settings/SettingsProvider'

// File extension configuration - change this to update the supported file extension
//const TARGET_FILE_EXTENSION = '*.rule'
const EDITOR_VIEW_TYPE = 'customFileEditor'
const EDITOR_DISPLAY_NAME = 'Rule Editor'

export class RuleEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new RuleEditorProvider(context)
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      RuleEditorProvider.viewType,
      provider
    )
    return providerRegistration
  }

  private static readonly viewType = EDITOR_VIEW_TYPE

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Setup initial content for the webview panel
    webviewPanel.webview.options = {
      enableScripts: true
    }

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview)

    const customDocument = new RuleDocument(document)
    logger.log('RuleDocument created', {
      rule: customDocument.rule,
      globs: customDocument.globs,
      content: customDocument.content,
      scheme: document.uri.scheme
    })

    // Send initial document data to webview
    this.updateWebview(webviewPanel, customDocument, document.uri)

    // Listen for changes from the webview
    webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'update':
            this.updateTextDocument(
              document,
              message.rule,
              message.globs,
              message.content
            )
            return
          case 'ready':
            // Re-send initial data when webview is ready
            this.updateWebview(webviewPanel, customDocument, document.uri)
            return
          case 'navigate':
            // Handle breadcrumb navigation - reveal in file explorer instead of opening as workspace
            try {
              const dirUri = vscode.Uri.file(message.path)
              await vscode.commands.executeCommand('revealInExplorer', dirUri)
              logger.log('Revealed directory in explorer', {
                path: message.path
              })
            } catch (error) {
              logger.log('Failed to reveal directory in explorer', {
                path: message.path,
                error: error instanceof Error ? error.message : String(error)
              })
            }
            return
          case 'log':
            // Handle log messages from the webview
            logger.log(`[Webview] ${message.message}`, message.data)
            return
          case 'openSettings':
            // Open the settings webview
            createSettingsWebview(this.context)
            return
        }
      },
      null,
      this.context.subscriptions
    )

    // Listen for changes to the document
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          this.updateWebview(
            webviewPanel,
            new RuleDocument(document),
            document.uri
          )
        }
      }
    )

    // Make sure we dispose of the listener when our editor is closed
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose()
    })
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce()

    // Get the webview bundle URI
    const webviewUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'bin', 'webview.js')
    )
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'bin', 'webview.css')
    )

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource};">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${EDITOR_DISPLAY_NAME}</title>
                <link href="${stylesUri}" rel="stylesheet">
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${webviewUri}"></script>
            </body>
            </html>`
  }

  private updateWebview(
    panel: vscode.WebviewPanel,
    customDocument: RuleDocument,
    documentUri: vscode.Uri
  ) {
    // Get workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

    panel.webview.postMessage({
      type: 'update',
      data: {
        rule: customDocument.rule,
        globs: customDocument.globs,
        content: customDocument.content,
        filePath: documentUri.fsPath,
        workspaceRoot: workspaceRoot || path.dirname(documentUri.fsPath) // Fallback to file directory if no workspace
      }
    })
  }

  private updateTextDocument(
    document: vscode.TextDocument,
    rule: string,
    globs: string,
    content: string
  ) {
    const edit = new vscode.WorkspaceEdit()

    // Create the new document content
    const newContent = this.createFileContent(rule, globs, content)

    // Replace the entire document
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      newContent
    )

    return vscode.workspace.applyEdit(edit)
  }

  private createFileContent(
    rule: string,
    globs: string,
    content: string
  ): string {
    return `---
rule: ${rule}
globs: ${globs}
---

${content}`
  }
}
