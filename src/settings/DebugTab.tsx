import React, { useState, useEffect, useRef, useCallback } from 'react'

interface VSCodeAPI {
  postMessage: (message: unknown) => void
}

interface DebugTabProps {
  vscode: VSCodeAPI
}

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'debug' | 'warn' | 'error'
  message: string
  data?: unknown
}

interface ExtensionInfo {
  id: string
  isBuiltin: boolean
  path: string
  exports: string[]
  packageInfo?: unknown
}

interface ExtensionInfoResponse {
  cursorExtensions: ExtensionInfo[]
  allExtensions: ExtensionInfo[]
}

export const DebugTab = ({ vscode }: DebugTabProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((level: LogEntry['level'], message: string, data?: unknown) => {
    const newLog: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      data
    }
    setLogs(prev => [...prev, newLog])
  }, [])

  const clearLogs = () => {
    setLogs([])
  }

  const loadExtensionInfo = () => {
    setIsLoading(true)
    addLog('info', 'Loading VS Code extension information...')

    // Send message to extension host to get extension info
    vscode.postMessage({
      type: 'getExtensionInfo'
    })
  }

  // Listen for messages from the extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message.type === 'extensionInfo') {
        setIsLoading(false)
        const { cursorExtensions, allExtensions } = message.data as ExtensionInfoResponse

        addLog('info', `Found ${cursorExtensions.length} Cursor-related extensions`)
        addLog('info', `Total extensions scanned: ${allExtensions.length}`)

        // Log Cursor extensions with detailed info
        for (const ext of cursorExtensions) {
          addLog('debug', `Cursor Extension: ${ext.id}`, {
            isBuiltin: ext.isBuiltin,
            path: ext.path,
            exports: ext.exports,
            packageInfo: ext.packageInfo
          })
        }

        // Only log non-cursor extensions if there are very few total extensions (for debugging)
        if (allExtensions.length < 10) {
          addLog('warn', 'Very few extensions found - showing all for debugging:')
          for (const ext of allExtensions) {
            addLog('debug', `Extension: ${ext.id}`, {
              isBuiltin: ext.isBuiltin,
              path: ext.path,
              exports: ext.exports
            })
          }
        }

        addLog('info', 'Extension information loading complete')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [addLog])

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  })

  const formatLogData = (data: unknown): string => {
    if (!data) return ''
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return '#4a9eff'
      case 'debug': return '#9ca3af'
      case 'warn': return '#f59e0b'
      case 'error': return '#ef4444'
      default: return '#9ca3af'
    }
  }

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return 'ℹ'
      case 'debug': return '🔍'
      case 'warn': return '⚠'
      case 'error': return '❌'
      default: return '•'
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="content-header">
        <h1 className="content-title">Debug Terminal</h1>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button
            className="open-button"
            onClick={loadExtensionInfo}
            disabled={isLoading}
            type="button"
          >
            {isLoading ? 'Loading...' : 'Load Extension Info'}
          </button>
          <button
            className="add-button"
            onClick={clearLogs}
            type="button"
          >
            Clear Terminal
          </button>
        </div>
      </div>

      <div
        ref={terminalRef}
        style={{
          flex: 1,
          backgroundColor: 'var(--vscode-editor-background)',
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: '4px',
          padding: '12px',
          fontFamily: 'var(--vscode-editor-font-family, "Consolas", monospace)',
          fontSize: '13px',
          lineHeight: '1.4',
          overflow: 'auto',
          color: 'var(--vscode-editor-foreground)',
          marginTop: '16px'
        }}
      >
        {logs.length === 0 ? (
          <div style={{
            color: 'var(--vscode-descriptionForeground)',
            fontStyle: 'italic'
          }}>
            Terminal ready. Click "Load Extension Info" to start debugging.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{
                  color: 'var(--vscode-descriptionForeground)',
                  fontSize: '12px',
                  minWidth: '70px'
                }}>
                  {log.timestamp}
                </span>
                <span style={{
                  color: getLevelColor(log.level),
                  minWidth: '16px'
                }}>
                  {getLevelIcon(log.level)}
                </span>
                <span style={{
                  color: getLevelColor(log.level),
                  fontWeight: 500,
                  minWidth: '50px',
                  textTransform: 'uppercase',
                  fontSize: '11px'
                }}>
                  {log.level}
                </span>
                <span style={{
                  flex: 1,
                  color: 'var(--vscode-editor-foreground)'
                }}>
                  {log.message}
                </span>
              </div>
              {log.data && (
                <div style={{
                  marginLeft: '102px',
                  marginTop: '4px',
                  padding: '8px',
                  backgroundColor: 'var(--vscode-input-background)',
                  border: '1px solid var(--vscode-panel-border)',
                  borderRadius: '3px',
                  fontSize: '12px',
                  color: 'var(--vscode-editor-foreground)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  <pre style={{
                    margin: 0,
                    fontFamily: 'inherit',
                    color: 'var(--vscode-editor-foreground)'
                  }}>
                    {String(formatLogData(log.data))}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
