import React, { useEffect, useState } from 'react'

interface VSCodeAPI {
  postMessage: (message: unknown) => void
}

interface GeneralTabProps {
  vscode: VSCodeAPI
}

interface RegistryState {
  userRegistry: string | null
  teamRegistry: string | null
}

export const GeneralTab = ({ vscode }: GeneralTabProps) => {
  const [registryState, setRegistryState] = useState<RegistryState>({
    userRegistry: null,
    teamRegistry: null
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

  const handleOpenEditorSettings = () => {
    vscode.postMessage({
      type: 'openEditorSettings'
    })
  }

  // Request initial registry state
  useEffect(() => {
    vscode.postMessage({
      type: 'getRegistryState'
    })
  }, [vscode])

  // Listen for registry state updates
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      switch (message.type) {
        case 'registryState':
          setRegistryState(message.data)
          break
        case 'registryAdded':
          setRegistryState(prev => ({
            ...prev,
            [`${message.data.registryType}Registry`]: message.data.url
          }))
          break
        case 'registryRemoved':
          setRegistryState(prev => ({
            ...prev,
            [`${message.data.registryType}Registry`]: null
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
    const registryKey = (`${type}Registry`) as keyof RegistryState
    const registryUrl = registryState[registryKey]
    const hasRegistry = !!registryUrl

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
                style={{ backgroundColor: 'var(--vscode-errorForeground)', borderColor: 'var(--vscode-errorForeground)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Remove">
                  <title>Remove registry</title>
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
                Remove Registry
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
        <p className="registry-description">{description}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="content-header">
        <h1 className="content-title">Registry Settings</h1>
      </div>

      <div className="registry-section">
        {renderRegistrySection('user', 'User Rules', 'Manage your custom user rules and preferences')}
        {renderRegistrySection('team', 'Team Rules', 'Manage your custom team rules and preferences')}
      </div>

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
    </div>
  )
}
