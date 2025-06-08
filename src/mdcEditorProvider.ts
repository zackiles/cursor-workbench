import * as vscode from 'vscode'
import { RuleDocument } from './ruleDocument'

// File extension constant - change this to update the supported file extension
const RULE_FILE_EXTENSION = '.rule'
const EDITOR_VIEW_TYPE = 'ruleEditor'

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

    const ruleDocument = new RuleDocument(document)

    // Send initial document data to webview
    this.updateWebview(webviewPanel, ruleDocument)

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
        }
      },
      null,
      this.context.subscriptions
    )

    // Listen for changes to the document
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          this.updateWebview(webviewPanel, new RuleDocument(document))
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

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Rule Editor</title>
                <style>
                    body { font-family: var(--vscode-editor-font-family); }
                    .container { padding: 20px; }
                    .field { margin-bottom: 15px; }
                    label { display: block; margin-bottom: 5px; font-weight: bold; }
                    input, textarea {
                        width: 100%;
                        padding: 8px;
                        border: 1px solid var(--vscode-input-border);
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                    }
                    textarea { height: 300px; resize: vertical; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="field">
                        <label for="rule">Rule:</label>
                        <input type="text" id="rule" placeholder="Enter rule name">
                    </div>
                    <div class="field">
                        <label for="globs">Globs:</label>
                        <input type="text" id="globs" placeholder="Enter file patterns">
                    </div>
                    <div class="field">
                        <label for="content">Content:</label>
                        <textarea id="content" placeholder="Enter markdown content"></textarea>
                    </div>
                </div>
                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();

                    const ruleInput = document.getElementById('rule');
                    const globsInput = document.getElementById('globs');
                    const contentTextarea = document.getElementById('content');

                    // Listen for messages from the extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'update':
                                ruleInput.value = message.rule || '';
                                globsInput.value = message.globs || '';
                                contentTextarea.value = message.content || '';
                                break;
                        }
                    });

                    // Send updates to extension
                    function sendUpdate() {
                        vscode.postMessage({
                            type: 'update',
                            rule: ruleInput.value,
                            globs: globsInput.value,
                            content: contentTextarea.value
                        });
                    }

                    ruleInput.addEventListener('input', sendUpdate);
                    globsInput.addEventListener('input', sendUpdate);
                    contentTextarea.addEventListener('input', sendUpdate);
                </script>
            </body>
            </html>`
  }

  private updateWebview(
    panel: vscode.WebviewPanel,
    ruleDocument: RuleDocument
  ) {
    panel.webview.postMessage({
      type: 'update',
      rule: ruleDocument.rule,
      globs: ruleDocument.globs,
      content: ruleDocument.content
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
    const newContent = this.createRuleContent(rule, globs, content)

    // Replace the entire document
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      newContent
    )

    return vscode.workspace.applyEdit(edit)
  }

  private createRuleContent(
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

function getNonce() {
  let text = ''
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
