import type * as vscode from 'vscode'
import { logger } from './logger'
import type { EditorSettings } from './types'

const DEFAULT_EXTENSIONS = ['.rule', '.mdc']
const STORAGE_KEY = 'cursorWorkbenchEditorSettings'

class ConfigManager {
  private context: vscode.ExtensionContext | null = null
  private isFirstTime = false
  private settings: EditorSettings = {
    isDefaultRuleEditor: false,
    enabledExtensions: DEFAULT_EXTENSIONS
  }

  async initialize(context: vscode.ExtensionContext): Promise<void> {
    this.context = context

    // Check if this is first installation before loading settings
    this.isFirstTime =
      context.globalState.get<EditorSettings>(STORAGE_KEY) === undefined

    // Load persisted settings
    const saved = context.globalState.get<EditorSettings>(STORAGE_KEY)
    if (saved) {
      this.settings = {
        ...this.settings,
        ...saved
      }
      logger.log('Loaded editor settings from storage', this.settings)
    } else {
      // First installation - set defaults and save
      await this.saveSettings()
      logger.log(
        'First installation - initialized default editor settings',
        this.settings
      )
    }
  }

  async saveSettings(): Promise<void> {
    if (!this.context) {
      throw new Error('ConfigManager not initialized')
    }

    await this.context.globalState.update(STORAGE_KEY, this.settings)
    logger.log('Saved editor settings', this.settings)
  }

  getSettings(): EditorSettings {
    return { ...this.settings }
  }

  getEnabledExtensions(): string[] {
    return [...this.settings.enabledExtensions]
  }

  async setEnabledExtensions(extensions: string[]): Promise<void> {
    // Validate extensions (must start with .)
    const validExtensions = extensions.filter(
      (ext) => ext.startsWith('.') && ext.length > 1
    )

    this.settings.enabledExtensions = validExtensions
    await this.saveSettings()

    logger.log('Updated enabled extensions', validExtensions)
  }

  async addExtension(extension: string): Promise<void> {
    const normalizedExtension = extension.startsWith('.')
      ? extension
      : `.${extension}`

    if (!this.settings.enabledExtensions.includes(normalizedExtension)) {
      this.settings.enabledExtensions.push(normalizedExtension)
      await this.saveSettings()
      logger.log('Added extension', normalizedExtension)
    }
  }

  async removeExtension(extension: string): Promise<void> {
    const index = this.settings.enabledExtensions.indexOf(extension)
    if (index > -1) {
      this.settings.enabledExtensions.splice(index, 1)
      await this.saveSettings()
      logger.log('Removed extension', extension)
    }
  }

  isRuleFile(fileName: string): boolean {
    const extension = fileName.toLowerCase()
    return this.settings.enabledExtensions.some((ext) =>
      extension.endsWith(ext.toLowerCase())
    )
  }

  getRuleFileExtensions(): string[] {
    return [...this.settings.enabledExtensions]
  }

  async setIsDefaultRuleEditor(isDefault: boolean): Promise<void> {
    this.settings.isDefaultRuleEditor = isDefault
    await this.saveSettings()
    logger.log('Updated isDefaultRuleEditor', isDefault)
  }

  getIsDefaultRuleEditor(): boolean {
    return this.settings.isDefaultRuleEditor
  }

  // Check if this is the first installation
  isFirstInstallation(): boolean {
    return this.isFirstTime
  }
}

export const configManager = new ConfigManager()
