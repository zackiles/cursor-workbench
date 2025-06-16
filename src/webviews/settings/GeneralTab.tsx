import React, { useEffect, useState } from 'react'
import type { VSCodeAPI, SettingsState, EditorSettings } from '../../common/types'

interface GeneralTabProps {
  vscode: VSCodeAPI
}

export const GeneralTab = ({ vscode }: GeneralTabProps) => {
  const [settingsState, setSettingsState] = useState<SettingsState>({
    userRegistry: null,
    teamRegistry: null,
    userRegistryFileCount: undefined,
    teamRegistryFileCount: undefined,
    editorSettings: {
      isDefaultRuleEditor: false,
      enabledExtensions: []
    }
  })

  // Handle registry add/remove
  const handleAddRegistry = (type: 'user' | 'team') => {
    vscode.postMessage({
      type: 'addRegistry',
      registryType: type
    })
  }

  const handleRemoveRegistry = (type: 'user' | 'team') => {
    vscode.postMessage({
      type: 'removeRegistry',
      registryType: type
    })
  }

  const handleToggleEditor = () => {
    vscode.postMessage({
      type: 'toggleEditor',
      enabled: !settingsState.editorSettings.isDefaultRuleEditor
    })
  }

  const handleUpdateExtensions = (extensions: string[]) => {
    vscode.postMessage({
      type: 'updateExtensions',
      extensions
    })
  }

  const handleOpenEditorSettings = () => {
    vscode.postMessage({
      type: 'openEditorSettings'
    })
  }

  // Request initial settings state
  useEffect(() => {
    vscode.postMessage({
      type: 'getSettingsState'
    })
  }, [vscode])

  // Listen for settings state updates
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      switch (message.type) {
        case 'settingsState':
          setSettingsState(message.data)
          break
        case 'registryAdded': {
          const registryType = message.data.registryType
          const fileCount = message.data.fileCount

          setSettingsState((prev: SettingsState) => ({
            ...prev,
            [`${registryType}Registry`]: message.data.url,
            [`${registryType}RegistryFileCount`]: fileCount
          }))
          break
        }
        case 'registryRemoved':
          setSettingsState((prev: SettingsState) => ({
            ...prev,
            [`${message.data.registryType}Registry`]: null,
            [`${message.data.registryType}RegistryFileCount`]: undefined
          }))
          break
        case 'registryError':
          // You could show an error notification here
          console.error('Registry error:', message.data.message)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const renderRegistrySection = (type: 'user' | 'team', title: string, description: string) => {
    const registryKey = `${type}Registry` as 'userRegistry' | 'teamRegistry'
    const fileCountKey = `${type}RegistryFileCount` as 'userRegistryFileCount' | 'teamRegistryFileCount'
    const registryUrl = settingsState[registryKey]
    const fileCount = settingsState[fileCountKey] as number | undefined
    const hasRegistry = !!registryUrl

    // Create description based on registry status
    const getDescription = () => {
      if (hasRegistry && typeof fileCount === 'number') {
        return `${fileCount} ${fileCount === 1 ? 'file' : 'files'} loaded from registry`
      }
      return description
    }

    return (
      <div className="registry-item">
        <div className="registry-header-flex">
          <div className="registry-title-section">
            <h2 className="registry-title">{title}</h2>
            <svg className="info-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-label="Info">
              <title>Information about {type} rules</title>
              <path d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z"/>
            </svg>
          </div>

          {hasRegistry ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                fontSize: '13px',
                color: 'var(--vscode-descriptionForeground)',
                fontFamily: 'var(--vscode-editor-font-family, monospace)',
                backgroundColor: 'var(--vscode-input-background)',
                padding: '4px 8px',
                borderRadius: '3px',
                border: '1px solid var(--vscode-panel-border)',
                maxWidth: '300px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {registryUrl}
              </span>
              <button
                className="add-button"
                onClick={() => handleRemoveRegistry(type)}
                type="button"
                style={{ backgroundColor: 'var(--vscode-errorForeground)', borderColor: 'var(--vscode-errorForeground)', minWidth: 'auto', padding: '6px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Remove">
                  <title>Remove registry</title>
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </button>
            </div>
          ) : (
            <button
              className="add-button"
              onClick={() => handleAddRegistry(type)}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Add">
                <title>Add registry</title>
                <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
              </svg>
              Add Registry
            </button>
          )}
        </div>
        <p className="registry-description">{getDescription()}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="content-header">
        <h1 className="content-title">Registry Settings</h1>
      </div>

      <div className="registry-section">
        {renderRegistrySection('team', 'Team Rules', 'Manage your custom team rules and preferences')}
        {/*{renderRegistrySection('user', 'User Rules', 'Manage your custom user rules and preferences')}*/}
      </div>

      <div className="editor-section">
        <h2 className="section-heading">Editor Settings</h2>

        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-title-section">
              <h3 className="setting-title">Enable Editor</h3>
              <svg className="info-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-label="Info">
                <title>Set this extension as the default editor for configured file types</title>
                <path d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z"/>
              </svg>
            </div>
            <p className="setting-description">
              Set this extension as the default editor for rule files
            </p>
          </div>
          <div className="setting-control">
            <label className="radio-switch">
              <input
                type="checkbox"
                checked={settingsState.editorSettings.isDefaultRuleEditor}
                onChange={handleToggleEditor}
              />
              <span className="radio-slider" />
            </label>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-title-section">
              <h3 className="setting-title">Enabled Rules</h3>
              <svg className="info-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-label="Info">
                <title>Configure which file extensions are treated as rule files</title>
                <path d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z"/>
              </svg>
            </div>
            <p className="setting-description">
              Configure file extensions that are treated as rule files (e.g., .rule, .mdc)
            </p>
          </div>
          <div className="setting-control">
            <div className="extensions-list">
              {settingsState.editorSettings.enabledExtensions.map((ext, index) => (
                <span key={ext} className="extension-tag">
                  {ext}
                  <button
                    className="remove-extension"
                    onClick={() => {
                      const newExtensions = settingsState.editorSettings.enabledExtensions.filter((_, i) => i !== index)
                      handleUpdateExtensions(newExtensions)
                    }}
                    type="button"
                    aria-label={`Remove ${ext}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder="Add extension..."
                className="add-extension-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const target = e.target as HTMLInputElement
                    let newExt = target.value.trim()
                    if (newExt && !newExt.startsWith('.')) {
                      newExt = `.${newExt}`
                    }
                    if (newExt && !settingsState.editorSettings.enabledExtensions.includes(newExt)) {
                      handleUpdateExtensions([...settingsState.editorSettings.enabledExtensions, newExt])
                      target.value = ''
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
      {/*
      <div className="preferences-section">
        <h2 className="preferences-heading">Preferences</h2>

        <div className="editor-settings-item">
          <div className="editor-settings-info">
            <h3 className="editor-settings-title">Editor Settings</h3>
            <p className="editor-settings-description">Configure font, formatting, minimap and more</p>
          </div>
          <div className="editor-settings-action">
            <button
              className="open-button"
              onClick={handleOpenEditorSettings}
              type="button"
            >
              Open
            </button>
          </div>
        </div>
      </div>
      */}
    </div>
  )
}
