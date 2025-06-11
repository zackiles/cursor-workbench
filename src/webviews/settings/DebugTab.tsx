import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { VSCodeAPI, LogEntry, ExtensionInfo, ExtensionInfoResponse } from '../../common/types'

interface DebugTabProps {
  vscode: VSCodeAPI
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
        className="debug-terminal"
      >
        {logs.length === 0 ? (
          <div className="debug-terminal-placeholder">
            Terminal ready. Click "Load Extension Info" to start debugging.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="log-entry">
              <div className="log-header">
                <span className="log-timestamp">
                  {log.timestamp}
                </span>
                <span className={`log-icon log-level-${log.level}`}>
                  {getLevelIcon(log.level)}
                </span>
                <span className={`log-label log-level-${log.level}`}>
                  {log.level}
                </span>
                <span className="log-message">
                  {log.message}
                </span>
              </div>
              {Boolean(log.data) && (
                <div className="log-data">
                  <pre>
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
