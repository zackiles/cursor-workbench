import * as vscode from 'vscode'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { CustomFileDocument } from './customFileDocument'
import { logger } from './logger'
import { createSettingsWebview } from './settingsWebviewProvider'

// File extension configuration - change this to update the supported file extension
const TARGET_FILE_EXTENSION = '*.rule'
const EDITOR_VIEW_TYPE = 'customFileEditor'
const EDITOR_DISPLAY_NAME = 'Custom File Editor'

export class CustomFileEditorProvider
  implements vscode.CustomTextEditorProvider
{
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new CustomFileEditorProvider(context)
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      CustomFileEditorProvider.viewType,
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

    const customDocument = new CustomFileDocument(document)
    logger.log('CustomFileDocument created', {
      rule: customDocument.rule,
      globs: customDocument.globs,
      content: customDocument.content
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
            // Handle breadcrumb navigation
            try {
              const dirUri = vscode.Uri.file(message.path)
              await vscode.commands.executeCommand(
                'vscode.openFolder',
                dirUri,
                { forceNewWindow: false }
              )
            } catch (error) {
              logger.log('Failed to navigate to directory', {
                path: message.path,
                error
              })
              // Fallback: reveal in explorer
              try {
                const dirUri = vscode.Uri.file(message.path)
                await vscode.commands.executeCommand('revealInExplorer', dirUri)
              } catch (fallbackError) {
                logger.log('Failed to reveal in explorer', {
                  path: message.path,
                  error: fallbackError
                })
              }
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
            new CustomFileDocument(document),
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

    // Read MDX Editor CSS
    let mdxEditorCSS = ''
    try {
      const cssPath = path.join(
        this.context.extensionPath,
        'bin',
        'mdx-editor.css'
      )
      mdxEditorCSS = fs.readFileSync(cssPath, 'utf8')
    } catch (error) {
      logger.log('Could not load MDX Editor CSS', error)
    }

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${EDITOR_DISPLAY_NAME}</title>
                <style>
                    /* MDX Editor CSS */
                    ${mdxEditorCSS}

                    /* VS Code integration styles with proper theme support */
                    body {
                        font-family: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
                        margin: 0;
                        padding: 0;
                        height: 100vh;
                        overflow: hidden;
                        background: var(--vscode-editor-background, #1e1e1e);
                        color: var(--vscode-editor-foreground, #d4d4d4);
                    }

                    /* Handle light theme specifically */
                    @media (prefers-color-scheme: light) {
                        body {
                            background: var(--vscode-editor-background, #ffffff);
                            color: var(--vscode-editor-foreground, #000000);
                        }
                    }

                    #root {
                        height: 100vh;
                        width: 100%;
                    }

                    /* MDX Editor component styling */
                    .vscode-mdx-editor {
                        height: 100% !important;
                        background: transparent !important;
                        color: inherit !important;
                        border: 2px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35)) !important;
                        border-radius: 6px !important;
                    }

                    /* Toolbar styling with better contrast */
                    .mdxeditor-toolbar {
                        background: var(--vscode-titleBar-activeBackground, rgba(128, 128, 128, 0.1)) !important;
                        border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35)) !important;
                        padding: 8px 12px !important;
                        border-radius: 4px 4px 0 0 !important;
                        color: var(--vscode-foreground, #d4d4d4) !important;
                    }

                    /* Content area with proper text visibility */
                    .mdxeditor-root-contenteditable,
                    .vscode-mdx-content {
                        font-family: var(--vscode-editor-font-family, 'Consolas', monospace) !important;
                        color: var(--vscode-editor-foreground, #d4d4d4) !important;
                        background: var(--vscode-editor-background, #1e1e1e) !important;
                        padding: 16px !important;
                        min-height: 300px !important;
                        border: none !important;
                        line-height: 1.5 !important;
                        font-size: 14px !important;
                        caret-color: var(--vscode-editorCursor-foreground, #ffffff) !important;
                    }

                    /* MDX Editor placeholder styling with proper word wrapping */
                    .mdxeditor-root-contenteditable[data-placeholder]:before,
                    .mdxeditor-root-contenteditable .mdxeditor-placeholder,
                    .ProseMirror .placeholder {
                        content: attr(data-placeholder) !important;
                        color: var(--vscode-input-placeholderForeground, #888888) !important;
                        opacity: 0.6 !important;
                        pointer-events: none !important;
                        position: absolute !important;
                        top: 16px !important;
                        left: 16px !important;
                        right: 16px !important;
                        white-space: pre-wrap !important;
                        word-wrap: break-word !important;
                        overflow-wrap: break-word !important;
                        hyphens: auto !important;
                        word-break: break-word !important;
                        line-height: 1.5 !important;
                        font-family: var(--vscode-editor-font-family, 'Consolas', monospace) !important;
                        font-size: 14px !important;
                        z-index: 1 !important;
                    }

                    /* Ensure placeholder wraps properly */
                    .mdxeditor-root-contenteditable:empty:before {
                        content: attr(placeholder) !important;
                        color: var(--vscode-input-placeholderForeground, #888888) !important;
                        opacity: 0.6 !important;
                        white-space: pre-wrap !important;
                        word-wrap: break-word !important;
                        overflow-wrap: break-word !important;
                        hyphens: auto !important;
                        word-break: break-word !important;
                        line-height: 1.5 !important;
                    }

                    /* Prosemirror editor theming */
                    .ProseMirror {
                        color: var(--vscode-editor-foreground, #d4d4d4) !important;
                        background: var(--vscode-editor-background, #1e1e1e) !important;
                        caret-color: var(--vscode-editorCursor-foreground, #ffffff) !important;
                        outline: none !important;
                        padding: 16px !important;
                        font-family: var(--vscode-editor-font-family, 'Consolas', monospace) !important;
                        font-size: 14px !important;
                        line-height: 1.5 !important;
                        word-wrap: break-word !important;
                        overflow-wrap: break-word !important;
                        white-space: pre-wrap !important;
                        word-break: break-word !important;
                    }

                    /* MDX Editor content wrapping - target the specific classes */
                    [class*="_contentEditable_"],
                    [class*="_placeholder_"] {
                        word-wrap: break-word !important;
                        overflow-wrap: break-word !important;
                        white-space: pre-wrap !important;
                        word-break: break-word !important;
                        hyphens: auto !important;
                        max-width: 100% !important;
                        box-sizing: border-box !important;
                    }

                    /* Ensure all paragraphs in MDX editor wrap properly */
                    .ProseMirror p,
                    [class*="_contentEditable_"] p,
                    .mdxeditor-root-contenteditable p {
                        word-wrap: break-word !important;
                        overflow-wrap: break-word !important;
                        white-space: pre-wrap !important;
                        word-break: break-word !important;
                        hyphens: auto !important;
                        max-width: 100% !important;
                        margin: 0 0 1em 0 !important;
                        box-sizing: border-box !important;
                    }

                    /* Selection theming */
                    .ProseMirror::selection,
                    .ProseMirror *::selection {
                        background: var(--vscode-editor-selectionBackground, rgba(173, 214, 255, 0.3)) !important;
                    }

                    /* Light theme overrides for content */
                    @media (prefers-color-scheme: light) {
                        .mdxeditor-root-contenteditable,
                        .vscode-mdx-content {
                            color: var(--vscode-editor-foreground, #000000) !important;
                            background: var(--vscode-editor-background, #ffffff) !important;
                            caret-color: var(--vscode-editorCursor-foreground, #000000) !important;
                        }

                        .ProseMirror {
                            color: var(--vscode-editor-foreground, #000000) !important;
                            background: var(--vscode-editor-background, #ffffff) !important;
                            caret-color: var(--vscode-editorCursor-foreground, #000000) !important;
                        }

                        /* Light theme word wrapping */
                        [class*="_contentEditable_"],
                        [class*="_placeholder_"],
                        .ProseMirror p,
                        [class*="_contentEditable_"] p,
                        .mdxeditor-root-contenteditable p {
                            color: var(--vscode-editor-foreground, #000000) !important;
                        }

                        .mdxeditor-root-contenteditable[data-placeholder]:before,
                        .mdxeditor-root-contenteditable .mdxeditor-placeholder,
                        .ProseMirror .placeholder,
                        .mdxeditor-root-contenteditable:empty:before {
                            color: var(--vscode-input-placeholderForeground, #666666) !important;
                        }
                    }

                    /* Frontmatter editor with high contrast */
                    .mdxeditor [data-lexical-editor] [data-lexical-frontmatter] {
                        background: var(--vscode-input-background, rgba(255, 255, 255, 0.05)) !important;
                        border: 2px solid var(--vscode-focusBorder, #007acc) !important;
                        border-radius: 4px !important;
                        padding: 12px !important;
                        margin-bottom: 16px !important;
                        position: relative !important;
                    }

                    /* Light theme frontmatter */
                    @media (prefers-color-scheme: light) {
                        .mdxeditor [data-lexical-editor] [data-lexical-frontmatter] {
                            background: var(--vscode-input-background, rgba(0, 0, 0, 0.05)) !important;
                        }
                    }

                    /* Frontmatter form fields with high contrast */
                    .mdxeditor [data-lexical-frontmatter] input,
                    .mdxeditor [data-lexical-frontmatter] textarea {
                        background: var(--vscode-input-background, rgba(255, 255, 255, 0.1)) !important;
                        color: var(--vscode-input-foreground, #ffffff) !important;
                        border: 1px solid var(--vscode-input-border, rgba(255, 255, 255, 0.3)) !important;
                        border-radius: 3px !important;
                        padding: 6px 8px !important;
                        font-family: var(--vscode-editor-font-family, monospace) !important;
                        font-size: 13px !important;
                        width: 100% !important;
                        margin-bottom: 8px !important;
                    }

                    /* Light theme form fields */
                    @media (prefers-color-scheme: light) {
                        .mdxeditor [data-lexical-frontmatter] input,
                        .mdxeditor [data-lexical-frontmatter] textarea {
                            background: var(--vscode-input-background, rgba(0, 0, 0, 0.1)) !important;
                            color: var(--vscode-input-foreground, #000000) !important;
                            border: 1px solid var(--vscode-input-border, rgba(0, 0, 0, 0.3)) !important;
                        }
                    }

                    /* Frontmatter labels with high visibility */
                    .mdxeditor [data-lexical-frontmatter] label {
                        color: var(--vscode-foreground, #ffffff) !important;
                        font-weight: 600 !important;
                        font-size: 12px !important;
                        margin-bottom: 4px !important;
                        display: block !important;
                        text-transform: uppercase !important;
                        letter-spacing: 0.5px !important;
                    }

                    /* Light theme labels */
                    @media (prefers-color-scheme: light) {
                        .mdxeditor [data-lexical-frontmatter] label {
                            color: var(--vscode-foreground, #000000) !important;
                        }
                    }

                    /* Buttons with high contrast */
                    .mdxeditor button {
                        background: var(--vscode-button-background, #0078d4) !important;
                        color: var(--vscode-button-foreground, #ffffff) !important;
                        border: 1px solid var(--vscode-button-border, transparent) !important;
                        border-radius: 3px !important;
                        padding: 6px 12px !important;
                        font-size: 12px !important;
                        cursor: pointer !important;
                        font-weight: 500 !important;
                    }

                    .mdxeditor button:hover {
                        background: var(--vscode-button-hoverBackground, #106ebe) !important;
                    }

                    /* All text elements - ensure visibility */
                    .mdxeditor * {
                        color: inherit !important;
                    }

                    .mdxeditor p,
                    .mdxeditor span,
                    .mdxeditor div {
                        color: var(--vscode-editor-foreground, #d4d4d4) !important;
                    }

                    /* Light theme text */
                    @media (prefers-color-scheme: light) {
                        .mdxeditor p,
                        .mdxeditor span,
                        .mdxeditor div {
                            color: var(--vscode-editor-foreground, #000000) !important;
                        }
                    }

                    /* Source mode with proper theme support */
                    .cm-editor {
                        background: var(--vscode-editor-background, #1e1e1e) !important;
                        color: var(--vscode-editor-foreground, #d4d4d4) !important;
                        border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35)) !important;
                    }

                    .cm-content {
                        font-family: var(--vscode-editor-font-family, monospace) !important;
                        color: inherit !important;
                    }

                    /* Frontmatter header label */
                    .mdxeditor [data-lexical-frontmatter]:before {
                        content: "YAML Frontmatter Fields" !important;
                        position: absolute !important;
                        top: -12px !important;
                        left: 12px !important;
                        background: var(--vscode-editor-background, #1e1e1e) !important;
                        color: var(--vscode-focusBorder, #007acc) !important;
                        font-size: 11px !important;
                        font-weight: 700 !important;
                        padding: 2px 6px !important;
                        border-radius: 3px !important;
                        text-transform: uppercase !important;
                        letter-spacing: 0.5px !important;
                    }

                    /* Light theme frontmatter label */
                    @media (prefers-color-scheme: light) {
                        .mdxeditor [data-lexical-frontmatter]:before {
                            background: var(--vscode-editor-background, #ffffff) !important;
                        }
                    }

                    /* Rule Editor Styles */
                    .rule-editor {
                        height: 100vh;
                        display: flex;
                        flex-direction: column;
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }

                    /* Header container for breadcrumbs and status indicators */
                    .header-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
                        background: var(--vscode-titleBar-inactiveBackground, rgba(128, 128, 128, 0.05));
                        padding: 4px 12px;
                        min-height: 24px;
                        gap: 12px;
                    }

                    /* Rule info styling */
                    .rule-info {
                        font-size: 11px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        color: var(--vscode-foreground, #cccccc);
                        flex: 1;
                    }

                    /* Status indicators */
                    .status-indicators {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        flex-shrink: 0;
                    }

                    .status-item {
                        position: relative;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        cursor: pointer;
                        padding: 2px;
                        border-radius: 2px;
                        transition: background-color 0.15s ease;
                    }

                    .status-item:hover {
                        background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1));
                    }

                    .status-icon {
                        opacity: 0.7;
                        color: var(--vscode-foreground, #cccccc);
                    }

                    .status-dot {
                        width: 6px;
                        height: 6px;
                        border-radius: 50%;
                        transition: all 0.2s ease;
                    }

                    .status-green {
                        background-color: #4ade80;
                        box-shadow: 0 0 4px rgba(74, 222, 128, 0.5);
                    }

                    .status-yellow {
                        background-color: #facc15;
                        box-shadow: 0 0 4px rgba(250, 204, 21, 0.5);
                    }

                    .status-red {
                        background-color: #ef4444;
                        box-shadow: 0 0 4px rgba(239, 68, 68, 0.5);
                    }

                    .status-item:hover .status-dot {
                        transform: scale(1.2);
                        box-shadow: 0 0 8px currentColor;
                    }

                    .gears-button {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 24px;
                        height: 24px;
                        background: transparent;
                        border: none;
                        cursor: pointer;
                        padding: 4px;
                        border-radius: 3px;
                        transition: background-color 0.15s ease;
                        color: var(--vscode-foreground, #cccccc);
                    }

                    .gears-button:hover {
                        background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1));
                    }

                    .gears-button:focus {
                        outline: 1px solid var(--vscode-focusBorder, #007acc);
                        outline-offset: 1px;
                    }

                    .gears-icon {
                        opacity: 0.8;
                        flex-shrink: 0;
                        transition: opacity 0.15s ease;
                    }

                    .gears-button:hover .gears-icon {
                        opacity: 1;
                    }

                    .rule-details {
                        display: flex;
                        flex-direction: column;
                        gap: 1px;
                        line-height: 1.2;
                    }

                    .rule-info-line {
                        color: var(--vscode-foreground, #cccccc);
                        font-size: 11px;
                        display: flex;
                        align-items: center;
                        gap: 0;
                    }

                    .scope-info-line {
                        color: var(--vscode-descriptionForeground, #999999);
                        font-size: 10px;
                        opacity: 0.8;
                        display: flex;
                        align-items: center;
                        gap: 0;
                    }

                    .format-info,
                    .scope-info,
                    .kind-info {
                        color: inherit;
                    }

                    .separator {
                        color: var(--vscode-descriptionForeground, #999999);
                        opacity: 0.6;
                        font-weight: normal;
                    }

                    /* Frontmatter form styling - made smaller and thinner */
                    .frontmatter-form {
                        padding: 8px 12px 6px 12px;
                        margin-top: 2px;
                        border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
                        background: var(--vscode-editor-background);
                        display: flex;
                        gap: 12px;
                        align-items: flex-start;
                        flex-wrap: wrap;
                        position: relative;
                        overflow: visible;
                    }

                    .form-row {
                        display: flex;
                        flex-direction: column;
                        min-width: 180px;
                        flex: 0 0 auto;
                        position: relative;
                        overflow: visible;
                    }

                    .form-row-flex {
                        flex: 1 1 auto;
                        min-width: 220px;
                    }

                    .form-row label {
                        display: block;
                        margin-bottom: 4px;
                        font-size: 10px;
                        font-weight: 600;
                        color: var(--vscode-input-foreground);
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        opacity: 0.9;
                    }

                    /* Select wrapper for custom arrow - made smaller */
                    .select-wrapper {
                        position: relative !important;
                        display: inline-block !important;
                        width: 100% !important;
                        min-width: 160px !important;
                    }

                    /* Enhanced select styling with custom dropdown arrow - made smaller and thinner */
                    .form-select {
                        width: 100% !important;
                        padding: 4px 28px 4px 8px !important;
                        background-color: var(--vscode-input-background, #3c3c3c) !important;
                        color: var(--vscode-input-foreground, #cccccc) !important;
                        border: 1px solid var(--vscode-input-border, #464647) !important;
                        border-radius: 2px !important;
                        font-size: 11px !important;
                        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif) !important;
                        -webkit-appearance: none !important;
                        -moz-appearance: none !important;
                        appearance: none !important;
                        cursor: pointer !important;
                        transition: border-color 0.15s ease, background-color 0.15s ease !important;
                        height: 24px !important;
                    }

                    /* Custom dropdown arrow - made smaller */
                    .select-wrapper::after {
                        content: '' !important;
                        position: absolute !important;
                        top: 50% !important;
                        right: 8px !important;
                        width: 0 !important;
                        height: 0 !important;
                        border-left: 4px solid transparent !important;
                        border-right: 4px solid transparent !important;
                        border-top: 5px solid var(--vscode-input-foreground, #cccccc) !important;
                        transform: translateY(-50%) !important;
                        pointer-events: none !important;
                        z-index: 1 !important;
                    }

                    .form-select:focus {
                        outline: none !important;
                        border-color: var(--vscode-focusBorder, #007acc) !important;
                        box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007acc) !important;
                    }

                    .form-select:hover {
                        border-color: var(--vscode-inputOption-hoverBackground, #464647) !important;
                    }

                    .form-select option {
                        background-color: var(--vscode-input-background, #3c3c3c) !important;
                        color: var(--vscode-input-foreground, #cccccc) !important;
                    }

                    /* Input styling - made smaller and thinner */
                    .form-input {
                        width: 100%;
                        min-width: 220px;
                        padding: 4px 8px;
                        background: var(--vscode-input-background, #3c3c3c);
                        color: var(--vscode-input-foreground, #cccccc);
                        border: 1px solid var(--vscode-input-border, #464647);
                        border-radius: 2px;
                        font-size: 11px;
                        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
                        transition: border-color 0.15s ease;
                        height: 24px;
                        box-sizing: border-box;
                    }

                    .form-input:focus {
                        outline: none;
                        border-color: var(--vscode-focusBorder, #007acc);
                        box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007acc);
                    }

                    .form-input::placeholder {
                        color: var(--vscode-input-placeholderForeground, #888888);
                        opacity: 0.6;
                    }

                    /* Notes section styling */
                    .notes-section {
                        border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
                        background: var(--vscode-editor-background);
                    }

                    .notes-toggle {
                        width: 100%;
                        padding: 8px 12px;
                        background: transparent;
                        border: none;
                        color: var(--vscode-foreground, #cccccc);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 11px;
                        font-weight: 500;
                        text-align: left;
                        transition: background-color 0.15s ease;
                    }

                    .notes-toggle:hover {
                        background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1));
                    }

                    .notes-toggle:focus {
                        outline: 1px solid var(--vscode-focusBorder, #007acc);
                        outline-offset: -1px;
                    }

                    .chevron-icon {
                        transition: transform 0.2s ease;
                        opacity: 0.7;
                    }

                    .chevron-icon.expanded {
                        transform: rotate(90deg);
                    }

                    .notes-content {
                        padding: 8px 12px 12px 12px;
                        animation: slideDown 0.2s ease-out;
                    }

                    @keyframes slideDown {
                        from {
                            opacity: 0;
                            transform: translateY(-10px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }

                    .notes-textarea {
                        width: 100%;
                        min-height: 72px;
                        max-height: 200px;
                        padding: 8px 10px;
                        background: var(--vscode-input-background, #3c3c3c);
                        color: var(--vscode-input-foreground, #cccccc);
                        border: 1px solid var(--vscode-input-border, #464647);
                        border-radius: 2px;
                        font-size: 11px;
                        font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
                        line-height: 1.4;
                        resize: vertical;
                        transition: border-color 0.15s ease;
                        box-sizing: border-box;
                    }

                    .notes-textarea:focus {
                        outline: none;
                        border-color: var(--vscode-focusBorder, #007acc);
                        box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007acc);
                    }

                    .notes-textarea::placeholder {
                        color: var(--vscode-input-placeholderForeground, #888888);
                        opacity: 0.6;
                    }

                    /* Content editor container */
                    .content-editor {
                        flex: 1;
                        padding: 12px 16px 16px 16px;
                        overflow: auto;
                    }

                    /* Light theme adjustments */
                    @media (prefers-color-scheme: light) {
                        .header-container {
                            background: var(--vscode-titleBar-inactiveBackground, rgba(128, 128, 128, 0.03));
                        }

                        .rule-info {
                            color: var(--vscode-foreground, #333333);
                        }

                        .rule-info-line {
                            color: var(--vscode-foreground, #333333);
                        }

                        .scope-info-line {
                            color: var(--vscode-descriptionForeground, #666666);
                        }

                        .format-info,
                        .scope-info,
                        .kind-info {
                            color: inherit;
                        }

                        .separator {
                            color: var(--vscode-descriptionForeground, #999999);
                        }

                        .gears-button {
                            color: var(--vscode-foreground, #333333);
                        }

                        .gears-button:hover {
                            background: var(--vscode-list-hoverBackground, rgba(0, 0, 0, 0.1));
                        }

                        .status-item:hover {
                            background: var(--vscode-list-hoverBackground, rgba(0, 0, 0, 0.1));
                        }

                        .status-icon {
                            color: var(--vscode-foreground, #333333);
                        }

                        .form-select {
                            background-color: var(--vscode-input-background, #ffffff) !important;
                            color: var(--vscode-input-foreground, #333333) !important;
                            border: 1px solid var(--vscode-input-border, #d1d1d1) !important;
                        }

                        .select-wrapper::after {
                            border-top-color: var(--vscode-input-foreground, #333333) !important;
                        }

                        .form-select option {
                            background-color: var(--vscode-input-background, #ffffff) !important;
                            color: var(--vscode-input-foreground, #333333) !important;
                        }

                        .form-input {
                            background: var(--vscode-input-background, #ffffff);
                            color: var(--vscode-input-foreground, #333333);
                            border: 1px solid var(--vscode-input-border, #d1d1d1);
                        }

                        .form-input::placeholder {
                            color: var(--vscode-input-placeholderForeground, #666666);
                        }

                        .notes-toggle {
                            color: var(--vscode-foreground, #333333);
                        }

                        .notes-toggle:hover {
                            background: var(--vscode-list-hoverBackground, rgba(0, 0, 0, 0.1));
                        }

                        .notes-textarea {
                            background: var(--vscode-input-background, #ffffff);
                            color: var(--vscode-input-foreground, #333333);
                            border: 1px solid var(--vscode-input-border, #d1d1d1);
                        }

                        .notes-textarea::placeholder {
                            color: var(--vscode-input-placeholderForeground, #666666);
                        }
                    }
                </style>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${webviewUri}"></script>
            </body>
            </html>`
  }

  private updateWebview(
    panel: vscode.WebviewPanel,
    customDocument: CustomFileDocument,
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

function getNonce() {
  let text = ''
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
