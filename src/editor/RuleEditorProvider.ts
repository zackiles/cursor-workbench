import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'
import { configManager } from '../common/configManager'
import { logger } from '../common/logger'
import { registryManager } from '../common/registryManager'
import type {
  AttachmentType,
  DetailedFileStatus,
  DocumentData
} from '../common/types'
import { getNonce } from '../common/utils'
import { createSettingsWebview } from '../settings/SettingsProvider'
import { RuleDocument } from './RuleDocument'

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
  private isUpdatingFromWebview = false

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Check if custom editor is enabled
    const isCustomEditorEnabled =
      configManager.getSettings().isDefaultRuleEditor

    if (!isCustomEditorEnabled) {
      // If custom editor is disabled, directly open with default editor
      logger.log('Custom editor is disabled, opening with default text editor')

      try {
        // Use the most reliable method to show the text document
        await vscode.window.showTextDocument(document, {
          viewColumn: webviewPanel.viewColumn || vscode.ViewColumn.One,
          preview: false
        })

        // Close this webview immediately after successfully opening the document
        webviewPanel.dispose()
        logger.log(
          'Successfully opened document with default editor and disposed webview'
        )
      } catch (error) {
        logger.log('Failed to open document with default editor:', error)
        vscode.window.showErrorMessage(
          `Failed to open ${path.basename(document.uri.fsPath)} with default editor: ${error}`
        )
        // Still dispose the webview even if opening failed
        webviewPanel.dispose()
      }

      return
    }

    // Setup initial content for the webview panel
    webviewPanel.webview.options = {
      enableScripts: true
    }

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview)

    const customDocument = new RuleDocument(document, document.uri.fsPath)
    logger.log('RuleDocument created', {
      attachmentType: customDocument.attachmentType,
      globs: customDocument.globs,
      contentLength: customDocument.content.length,
      contentPreview:
        customDocument.content.substring(0, 200) +
        (customDocument.content.length > 200 ? '...' : ''),
      scheme: document.uri.scheme,
      filePath: document.uri.fsPath
    })

    // Send initial document data to webview
    this.updateWebview(webviewPanel, customDocument, document.uri)

    // Listen for changes from the webview
    webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'update':
            this.isUpdatingFromWebview = true
            try {
              await this.updateTextDocument(
                document,
                message.attachmentType,
                message.globs,
                message.description,
                message.notes,
                message.alwaysApply,
                message.content,
                message.frontmatter || {}
              )
            } finally {
              // Reset flag after a short delay to ensure document change event has fired
              setTimeout(() => {
                this.isUpdatingFromWebview = false
              }, 50)
            }
            return
          case 'ready':
            // Re-send initial data when webview is ready
            await this.updateWebview(webviewPanel, customDocument, document.uri)
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
          case 'remoteStatusClick':
            // Handle remote status click from webview
            this.handleRemoteStatusClick(
              message.status,
              message.filePath,
              document
            )
            return
          case 'commitAndPush':
            // Handle commit and push action from modal
            this.handleCommitAndPush(
              message.filePath,
              message.commitMessage,
              message.shouldRebase,
              document
            )
            return
          case 'pullChanges':
            // Handle pull changes action from modal
            this.handlePullChanges(message.filePath, document)
            return
        }
      },
      null,
      this.context.subscriptions
    )

    // Listen for changes to the document
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      async (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          // Skip if we're updating from webview to prevent feedback loop
          if (this.isUpdatingFromWebview) {
            return
          }

          // Read the updated content resolving symlinks
          const updatedContent = await this.readFileContent(document.uri)
          const updatedDocument = new RuleDocument(
            {
              getText: () => updatedContent
            } as vscode.TextDocument,
            document.uri.fsPath
          )
          await this.updateWebview(webviewPanel, updatedDocument, document.uri)
        }
      }
    )

    // Listen for file save events to update local status
    const saveDocumentSubscription = vscode.workspace.onDidSaveTextDocument(
      async (savedDocument) => {
        if (savedDocument.uri.toString() === document.uri.toString()) {
          logger.log('File saved, updating webview', {
            savedDocumentUri: savedDocument.uri.toString(),
            documentUri: document.uri.toString()
          })
          // Read the updated content resolving symlinks
          const updatedContent = await this.readFileContent(document.uri)
          const updatedDocument = new RuleDocument(
            {
              getText: () => updatedContent
            } as vscode.TextDocument,
            document.uri.fsPath
          )
          await this.updateWebview(webviewPanel, updatedDocument, document.uri)
        }
      }
    )

    // Listen for git repository changes to update status
    let gitStatusSubscription: vscode.Disposable | undefined
    let fileWatcherSubscription: vscode.Disposable | undefined
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git')
      if (gitExtension) {
        await gitExtension.activate()
        const git = gitExtension.exports.getAPI(1)
        // Use the repo root (private storage) for git repository listener
        const realPath = this.resolveRealPath(document.uri)
        const teamRegistry = registryManager.getTeamRegistry()
        if (!teamRegistry) {
          logger.log('No team registry available for git listener setup')
          return
        }
        const repoRootPath = path.join(teamRegistry.storageLocation, 'repo')
        const repoRootUri = vscode.Uri.file(repoRootPath)
        const repo = git.getRepository(repoRootUri)
        if (repo) {
          logger.log(
            'Setting up git status listener for private storage repo',
            {
              repoRootPath,
              realPath,
              virtualPath: document.uri.fsPath
            }
          )
          gitStatusSubscription = repo.state.onDidChange(async () => {
            // Update status when git state changes in private storage
            logger.log('Git state changed in private storage, updating status')
            const updatedContent = await this.readFileContent(document.uri)
            const updatedDocument = new RuleDocument(
              {
                getText: () => updatedContent
              } as vscode.TextDocument,
              document.uri.fsPath
            )
            await this.updateWebview(
              webviewPanel,
              updatedDocument,
              document.uri
            )
          })
        } else {
          logger.log('No git repository found for private storage repo root', {
            repoRootPath,
            realPath,
            virtualPath: document.uri.fsPath
          })
        }
      }
    } catch (error) {
      logger.log('Failed to setup git status listener:', error)
    }

    // Also watch the real file for changes to ensure status updates
    try {
      const realPath = this.resolveRealPath(document.uri)
      const realFileUri = vscode.Uri.file(realPath)

      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          vscode.Uri.file(path.dirname(realPath)),
          path.basename(realPath)
        )
      )

      const updateFromFileChange = async () => {
        logger.log('Real file changed, updating status', { realPath })
        const updatedContent = await this.readFileContent(document.uri)
        const updatedDocument = new RuleDocument(
          {
            getText: () => updatedContent
          } as vscode.TextDocument,
          document.uri.fsPath
        )
        await this.updateWebview(webviewPanel, updatedDocument, document.uri)
      }

      watcher.onDidChange(updateFromFileChange)
      watcher.onDidCreate(updateFromFileChange)
      watcher.onDidDelete(updateFromFileChange)

      fileWatcherSubscription = watcher

      logger.log('Set up file system watcher for real path', { realPath })
    } catch (error) {
      logger.log('Failed to setup file system watcher:', error)
    }

    // Make sure we dispose of the listeners when our editor is closed
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose()
      saveDocumentSubscription.dispose()
      gitStatusSubscription?.dispose()
      fileWatcherSubscription?.dispose()
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

  /**
   * Check the local status of the file
   * Green: file exists and has no unsaved changes
   * Yellow: file has unsaved changes
   * Red: file doesn't exist on disk yet (new file)
   */
  private getLocalStatus(
    document: vscode.TextDocument
  ): 'green' | 'yellow' | 'red' {
    try {
      // Check if document has unsaved changes (most important check)
      if (document.isDirty) {
        return 'yellow'
      }

      // Check if file exists on disk
      const fileExists = fs.existsSync(document.uri.fsPath)
      if (!fileExists) {
        return 'red'
      }

      // File exists and is clean
      return 'green'
    } catch (error) {
      logger.log('Error checking local status:', error)
      return 'green' // Default to green on error
    }
  }

  /**
   * Check the remote git status of the file using detailed status information
   */
  private async getRemoteStatus(
    document: vscode.TextDocument
  ): Promise<'green' | 'yellow' | 'red' | 'gray'> {
    try {
      // First check if this file is from a registry
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      const teamRegistry = registryManager.getTeamRegistry()

      if (!teamRegistry || !workspaceRoot) {
        return 'gray'
      }

      // Check if this file is part of the team registry
      const relativePath = path.relative(workspaceRoot, document.uri.fsPath)
      const normalizedRelativePath = relativePath.replace(/\\/g, '/')

      if (!teamRegistry.files.includes(normalizedRelativePath)) {
        return 'gray'
      }

      // Get detailed status
      const detailedStatus = await registryManager.getDetailedFileStatus(
        normalizedRelativePath
      )

      // Determine color based on detailed status
      if (
        detailedStatus.hasUnstagedChanges ||
        detailedStatus.hasUncommittedChanges
      ) {
        return 'red' // Local changes need to be committed
      }

      if (detailedStatus.remoteStatus === 'ahead') {
        return 'yellow' // Local commits need to be pushed
      }

      if (detailedStatus.remoteStatus === 'behind') {
        return 'yellow' // Remote changes need to be pulled
      }

      if (detailedStatus.remoteStatus === 'diverged') {
        return 'red' // Conflicts need to be resolved
      }

      if (detailedStatus.remoteStatus === 'up-to-date') {
        return 'green' // Everything is in sync
      }

      return 'gray' // No remote or unknown status
    } catch (error) {
      logger.log('Error checking remote status:', error)
      return 'gray'
    }
  }

  /**
   * Resolve symlinks to get the actual file path for reading content
   * This ensures we read from the registry storage location, not the symlink
   */
  private resolveRealPath(uri: vscode.Uri): string {
    const virtualPath = uri.fsPath

    // First check if the file exists as a real file or symlink in the project
    try {
      if (fs.existsSync(virtualPath)) {
        const stats = fs.lstatSync(virtualPath)
        if (stats.isSymbolicLink()) {
          // Follow the symlink to get the real path
          const realPath = fs.readlinkSync(virtualPath)
          logger.log('Resolved symlink to real path', {
            virtualPath,
            realPath
          })
          return realPath
        } else if (stats.isFile()) {
          // It's a real file in the project - use it directly
          logger.log('Using real project file', { virtualPath })
          return virtualPath
        }
      }
    } catch (error) {
      logger.log('Error checking file existence or symlink', {
        virtualPath,
        error: error instanceof Error ? error.message : String(error)
      })
    }

    // If file doesn't exist locally, check if this file exists in the team registry
    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
    const teamRegistry = registryManager.getTeamRegistry()

    if (teamRegistry && workspaceRoot) {
      const relativePath = path.relative(workspaceRoot, virtualPath)
      // Normalize path separators for comparison
      const normalizedRelativePath = relativePath.replace(/\\/g, '/')

      if (teamRegistry.files.includes(normalizedRelativePath)) {
        const registryFilePath = path.join(
          teamRegistry.storageLocation,
          '.cursor',
          path.relative('.cursor', normalizedRelativePath)
        )
        logger.log('Resolving to team registry file', {
          virtualPath,
          relativePath: normalizedRelativePath,
          registryFilePath
        })
        return registryFilePath
      }
    }

    // Fallback to actual file path
    logger.log('Using fallback path', { virtualPath })
    return virtualPath
  }

  /**
   * Read file content directly from the resolved real path
   * This bypasses VS Code's document cache which might not handle symlinks properly
   */
  private async readFileContent(uri: vscode.Uri): Promise<string> {
    const realPath = this.resolveRealPath(uri)

    try {
      const content = fs.readFileSync(realPath, 'utf8')
      logger.log('Successfully read file content from real path', {
        originalPath: uri.fsPath,
        realPath,
        contentLength: content.length,
        contentPreview:
          content.substring(0, 500) + (content.length > 500 ? '...' : '')
      })
      return content
    } catch (error) {
      logger.log('Error reading file from real path, trying VS Code document', {
        originalPath: uri.fsPath,
        realPath,
        error: error instanceof Error ? error.message : String(error)
      })

      // Fallback to VS Code document if direct read fails
      try {
        const document = await vscode.workspace.openTextDocument(uri)
        const content = document.getText()
        logger.log('Successfully read content via VS Code document', {
          contentLength: content.length
        })
        return content
      } catch (vscodeError) {
        logger.log('Failed to read via VS Code document as well', {
          error:
            vscodeError instanceof Error
              ? vscodeError.message
              : String(vscodeError)
        })
        // Return empty string as final fallback
        return ''
      }
    }
  }

  private async updateWebview(
    panel: vscode.WebviewPanel,
    customDocument: RuleDocument,
    documentUri: vscode.Uri
  ) {
    // Get workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

    // Read the actual file content (resolving symlinks)
    const actualContent = await this.readFileContent(documentUri)
    const resolvedDocument = new RuleDocument(
      {
        getText: () => actualContent
      } as vscode.TextDocument,
      documentUri.fsPath
    )

    // Get status information using the existing document or open it fresh
    let localStatus: 'green' | 'yellow' | 'red' = 'green'
    let remoteStatus: 'green' | 'yellow' | 'red' | 'gray' = 'green'
    let detailedStatus: DetailedFileStatus | undefined

    try {
      const document = await vscode.workspace.openTextDocument(documentUri)
      localStatus = this.getLocalStatus(document)
      remoteStatus = await this.getRemoteStatus(document)

      // Get detailed status if this is a registry file
      const teamRegistry = registryManager.getTeamRegistry()
      if (teamRegistry && workspaceRoot) {
        const relativePath = path.relative(workspaceRoot, documentUri.fsPath)
        const normalizedRelativePath = relativePath.replace(/\\/g, '/')

        if (teamRegistry.files.includes(normalizedRelativePath)) {
          detailedStatus = await registryManager.getDetailedFileStatus(
            normalizedRelativePath
          )
        }
      }
    } catch (error) {
      logger.log('Error getting document status:', error)
      // Use defaults on error
    }

    const messageData: DocumentData = {
      attachmentType: resolvedDocument.attachmentType,
      globs: resolvedDocument.globs || '',
      description: resolvedDocument.description || '',
      notes: resolvedDocument.notes || '',
      alwaysApply: resolvedDocument.alwaysApply,
      content: resolvedDocument.content,
      filePath: documentUri.fsPath,
      workspaceRoot: workspaceRoot || path.dirname(documentUri.fsPath),
      localStatus,
      remoteStatus,
      detailedStatus,
      frontmatter: resolvedDocument.frontmatter
    }

    logger.log('Sending data to webview:', {
      ...messageData,
      contentLength: messageData.content.length,
      contentPreview: messageData.content.substring(0, 300),
      parsedContentLength: resolvedDocument.content.length,
      parsedContentPreview: resolvedDocument.content.substring(0, 200)
    })

    panel.webview.postMessage({
      type: 'update',
      data: messageData
    })
  }

  private async updateTextDocument(
    document: vscode.TextDocument,
    attachmentType: AttachmentType,
    globs: string,
    description: string,
    notes: string,
    alwaysApply: boolean,
    content: string,
    frontmatter: Record<string, unknown>
  ) {
    const edit = new vscode.WorkspaceEdit()

    // Create the new document content
    const newContent = this.createFileContent(
      attachmentType,
      globs,
      description,
      notes,
      alwaysApply,
      content,
      frontmatter
    )

    // Replace the entire document
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      newContent
    )

    return vscode.workspace.applyEdit(edit)
  }

  private createFileContent(
    attachmentType: AttachmentType,
    globs: string,
    description: string,
    notes: string,
    alwaysApply: boolean,
    content: string,
    frontmatter: Record<string, unknown>
  ): string {
    // Start with existing frontmatter to preserve all fields
    const updatedFrontmatter = { ...frontmatter }

    // Update specific fields based on attachment type
    this.updateFrontmatterForAttachmentType(
      updatedFrontmatter,
      attachmentType,
      globs,
      description,
      notes,
      alwaysApply
    )

    // Convert frontmatter to YAML
    const frontmatterFields: string[] = []

    for (const [key, value] of Object.entries(updatedFrontmatter)) {
      // Include all fields except undefined/null, but allow empty strings
      if (value !== undefined && value !== null) {
        frontmatterFields.push(this.formatFrontmatterField(key, value))
      }
    }

    if (frontmatterFields.length > 0) {
      return `---
${frontmatterFields.join('\n')}
---

${content}`
    }

    // No frontmatter needed if all fields are empty
    return content
  }

  private updateFrontmatterForAttachmentType(
    frontmatter: Record<string, unknown>,
    attachmentType: AttachmentType,
    globs: string,
    description: string,
    notes: string,
    alwaysApply: boolean
  ): void {
    // Always include these core fields, even if empty
    frontmatter.alwaysApply = alwaysApply
    frontmatter.globs = globs || ''
    frontmatter.description = description || ''

    // Only include notes if it has content
    if (notes?.trim()) {
      frontmatter.notes = notes
    } else {
      frontmatter.notes = undefined
    }
  }

  private formatFrontmatterField(key: string, value: unknown): string {
    if (typeof value === 'boolean') {
      return `${key}: ${value}`
    }
    if (typeof value === 'number') {
      return `${key}: ${value}`
    }
    if (Array.isArray(value)) {
      return `${key}: ${value.join(',')}`
    }
    if (typeof value === 'string') {
      // Don't use quotes for strings - just output the raw value
      return `${key}: ${value}`
    }
    // For other types, convert to string without quotes
    return `${key}: ${String(value)}`
  }

  private async handleRemoteStatusClick(
    status: 'green' | 'yellow' | 'red' | 'gray',
    filePath: string,
    document: vscode.TextDocument
  ) {
    // Get detailed status for more sophisticated modal
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    const teamRegistry = registryManager.getTeamRegistry()

    if (!teamRegistry || !workspaceRoot) {
      vscode.window.showInformationMessage(
        'Remote status is not available because this file is not part of a synchronized rule registry.',
        { modal: true }
      )
      return
    }

    const relativePath = path.relative(workspaceRoot, filePath)
    const normalizedRelativePath = relativePath.replace(/\\/g, '/')

    if (!teamRegistry.files.includes(normalizedRelativePath)) {
      vscode.window.showInformationMessage(
        'Remote status is not available because this file is not part of a synchronized rule registry.',
        { modal: true }
      )
      return
    }

    try {
      const detailedStatus = await registryManager.getDetailedFileStatus(
        normalizedRelativePath
      )

      const fileName = path.basename(filePath)

      // Determine the modal type based on detailed status
      if (
        detailedStatus.hasUnstagedChanges ||
        detailedStatus.hasUncommittedChanges
      ) {
        if (
          detailedStatus.remoteStatus === 'behind' ||
          detailedStatus.remoteStatus === 'diverged'
        ) {
          // Case #3: Both local changes and remote changes
          await this.showCommitAndRebaseModal(
            fileName,
            normalizedRelativePath,
            detailedStatus
          )
        } else {
          // Case #1: Only local changes
          await this.showCommitModal(
            fileName,
            normalizedRelativePath,
            detailedStatus
          )
        }
      } else if (detailedStatus.remoteStatus === 'behind') {
        // Case #2: Only remote changes
        await this.showUpdateModal(
          fileName,
          normalizedRelativePath,
          detailedStatus
        )
      } else if (detailedStatus.remoteStatus === 'ahead') {
        // Local commits to push
        await this.showPushModal(
          fileName,
          normalizedRelativePath,
          detailedStatus
        )
      } else if (detailedStatus.remoteStatus === 'up-to-date') {
        // Everything is in sync
        vscode.window.showInformationMessage(
          `${fileName} is up to date with the remote registry.`,
          { modal: true }
        )
      } else {
        // No remote or unknown status
        vscode.window.showInformationMessage(
          `Remote status for ${fileName} could not be determined.`,
          { modal: true }
        )
      }
    } catch (error) {
      logger.log('Error getting detailed status for modal', { error })
      vscode.window.showErrorMessage(
        `Failed to get Git status: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private async showCommitModal(
    fileName: string,
    filePath: string,
    detailedStatus: DetailedFileStatus
  ) {
    const commitMessage = await vscode.window.showInputBox({
      prompt: `Commit message for ${fileName}`,
      placeHolder: 'Enter a commit message...',
      value: `Update ${fileName}`,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Commit message cannot be empty'
        }
        return null
      }
    })

    if (commitMessage) {
      try {
        await registryManager.stageAndCommitFile(filePath, commitMessage.trim())
        await registryManager.pushChanges()

        vscode.window.showInformationMessage(
          `Successfully committed and pushed ${fileName}`
        )

        // Refresh file decorations
        await registryManager.refreshFileDecorations()
      } catch (error) {
        logger.log('Error committing and pushing file', { error })
        vscode.window.showErrorMessage(
          `Failed to commit and push: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }

  private async showCommitAndRebaseModal(
    fileName: string,
    filePath: string,
    detailedStatus: DetailedFileStatus
  ) {
    const commitMessage = await vscode.window.showInputBox({
      prompt: `Commit message for ${fileName} (will rebase with remote changes)`,
      placeHolder: 'Enter a commit message...',
      value: `Update ${fileName}`,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Commit message cannot be empty'
        }
        return null
      }
    })

    if (commitMessage) {
      try {
        // First commit local changes
        await registryManager.stageAndCommitFile(filePath, commitMessage.trim())

        // Then fetch, rebase, and push
        await registryManager.fetchAndRebaseThenPush()

        vscode.window.showInformationMessage(
          `Successfully committed, rebased, and pushed ${fileName}`
        )

        // Refresh file decorations
        await registryManager.refreshFileDecorations()
      } catch (error) {
        logger.log('Error committing, rebasing, and pushing file', { error })
        vscode.window.showErrorMessage(
          `Failed to commit and rebase: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }

  private async showUpdateModal(
    fileName: string,
    filePath: string,
    detailedStatus: DetailedFileStatus
  ) {
    const remoteHash =
      detailedStatus.remoteCommitHash?.substring(0, 8) || 'unknown'

    const selection = await vscode.window.showInformationMessage(
      `The remote registry version of ${fileName} has changed (commit: ${remoteHash}). Would you like to update to the latest version?`,
      { modal: true },
      'Update',
      'Cancel'
    )

    if (selection === 'Update') {
      try {
        await registryManager.pullChanges()

        vscode.window.showInformationMessage(
          `Successfully updated ${fileName} from remote registry`
        )

        // Refresh file decorations
        await registryManager.refreshFileDecorations()
      } catch (error) {
        logger.log('Error pulling changes', { error })
        vscode.window.showErrorMessage(
          `Failed to update from remote: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }

  private async showPushModal(
    fileName: string,
    filePath: string,
    detailedStatus: DetailedFileStatus
  ) {
    const selection = await vscode.window.showInformationMessage(
      `${fileName} has local commits that haven't been pushed to the remote registry. Would you like to push them now?`,
      { modal: true },
      'Push',
      'Cancel'
    )

    if (selection === 'Push') {
      try {
        await registryManager.pushChanges()

        vscode.window.showInformationMessage(
          `Successfully pushed ${fileName} to remote registry`
        )

        // Refresh file decorations
        await registryManager.refreshFileDecorations()
      } catch (error) {
        logger.log('Error pushing changes', { error })
        vscode.window.showErrorMessage(
          `Failed to push to remote: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }

  private async handleCommitAndPush(
    filePath: string,
    commitMessage: string,
    shouldRebase: boolean,
    document: vscode.TextDocument
  ) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!workspaceRoot) return

    const relativePath = path.relative(workspaceRoot, filePath)
    const normalizedRelativePath = relativePath.replace(/\\/g, '/')

    try {
      // Stage and commit the file
      await registryManager.stageAndCommitFile(
        normalizedRelativePath,
        commitMessage
      )

      if (shouldRebase) {
        // Fetch, rebase, and push
        await registryManager.fetchAndRebaseThenPush()
      } else {
        // Just push
        await registryManager.pushChanges()
      }

      vscode.window.showInformationMessage(
        `Successfully committed and pushed ${path.basename(filePath)}`
      )

      // Refresh file decorations
      await registryManager.refreshFileDecorations()
    } catch (error) {
      logger.log('Error in handleCommitAndPush', { error })
      vscode.window.showErrorMessage(
        `Failed to commit and push: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private async handlePullChanges(
    filePath: string,
    document: vscode.TextDocument
  ) {
    try {
      await registryManager.pullChanges()

      vscode.window.showInformationMessage(
        `Successfully updated ${path.basename(filePath)} from remote registry`
      )

      // Refresh file decorations
      await registryManager.refreshFileDecorations()
    } catch (error) {
      logger.log('Error in handlePullChanges', { error })
      vscode.window.showErrorMessage(
        `Failed to pull changes: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
