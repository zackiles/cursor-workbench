import * as vscode from 'vscode'

class Logger {
  private static instance: Logger
  private outputChannel: vscode.OutputChannel

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Cursor Workbench')
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  public log(message: string, data?: unknown): void {
    const timestamp = new Date().toISOString()
    const logMessage = data
      ? `[${timestamp}] ${message} ${JSON.stringify(data, null, 2)}`
      : `[${timestamp}] ${message}`

    this.outputChannel.appendLine(logMessage)
  }

  public show(): void {
    this.outputChannel.show()
  }
}

export const logger = Logger.getInstance()
