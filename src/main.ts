import * as vscode from 'vscode'
import { CustomFileEditorProvider } from './customFileEditorProvider'

export function activate(context: vscode.ExtensionContext) {
  // Register the custom text editor provider for custom files
  const providerRegistration = CustomFileEditorProvider.register(context)
  context.subscriptions.push(providerRegistration)
}

export function deactivate() {
  // Extension cleanup
}
