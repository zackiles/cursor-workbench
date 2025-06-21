import { useEffect, useState } from 'react'
import type { VSCodeAPI } from '../../common/types'
import { DebugTab } from './DebugTab'
import { DocsTab } from './DocsTab'
import { GeneralTab } from './GeneralTab'
import './Settings.css'

interface SettingsProps {
  vscode: VSCodeAPI
}

type TabType = 'general' | 'debug' | 'docs'

interface TabConfig {
  id: TabType
  label: string
  icon: React.ReactElement
}

const tabs: TabConfig[] = [
  {
    id: 'general',
    label: 'General',
    icon: (
      <svg
        width='18'
        height='18'
        viewBox='0 0 24 24'
        fill='currentColor'
        aria-label='Settings'
      >
        <title>Settings</title>
        <path d='M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z' />
      </svg>
    )
  },
  {
    id: 'debug',
    label: 'Debug',
    icon: (
      <svg
        width='18'
        height='18'
        viewBox='0 0 24 24'
        fill='currentColor'
        aria-label='Debug'
      >
        <title>Debug</title>
        <path d='M5,6H10V4H14V6H19L18,7H6L5,6M6,8H18V19A2,2 0 0,1 16,21H8A2,2 0 0,1 6,19V8M8,10V19H10V10H8M14,10V19H16V10H14Z' />
        <circle cx='12' cy='13' r='2' />
      </svg>
    )
  },
  {
    id: 'docs',
    label: 'Docs',
    icon: (
      <svg
        width='18'
        height='18'
        viewBox='0 0 24 24'
        fill='currentColor'
        aria-label='Documentation'
      >
        <title>Documentation</title>
        <path d='M19,2L14,6.5V17.5L19,13V2M6.5,5C4.55,5 2.45,5.4 1,6.5V21.16C1,21.41 1.25,21.66 1.5,21.66C1.6,21.66 1.65,21.59 1.75,21.59C3.1,20.94 5.05,20.68 6.5,20.68C8.45,20.68 10.55,21.1 12,22C13.35,21.15 15.8,20.68 17.5,20.68C19.15,20.68 20.85,20.92 22.25,21.81C22.35,21.86 22.4,21.91 22.5,21.91C22.75,21.91 23,21.66 23,21.41V6.5C22.4,6.05 21.75,5.75 21,5.5V19C19.9,18.65 18.7,18.5 17.5,18.5C15.8,18.5 13.35,18.9 12,19.5V8C10.55,7.1 8.45,6.5 6.5,6.5H6.5Z' />
      </svg>
    )
  }
]

export const Settings = ({ vscode }: SettingsProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('general')
  // Add a key state to force re-render on refresh
  const [renderKey, setRenderKey] = useState(Date.now())

  console.log('Settings component mounting with key:', renderKey)

  // Listen for refresh messages from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      if (message.type === 'refresh') {
        console.log(
          'Received refresh message from extension, refreshing component'
        )
        // Force re-render by updating the key
        setRenderKey(Date.now())

        // Also reload any CSS by creating a temporary link element
        const linkEl = document.createElement('link')
        linkEl.setAttribute('rel', 'stylesheet')
        linkEl.setAttribute('href', `bin/webview.css?v=${Date.now()}`)

        // Remove the link element after it loads
        linkEl.onload = () => {
          document.head.removeChild(linkEl)
          console.log('Refreshed CSS loaded')
        }

        document.head.appendChild(linkEl)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleTabClick = (tabId: TabType) => {
    setActiveTab(tabId)
  }

  const handleTabKeyDown = (event: React.KeyboardEvent, tabId: TabType) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setActiveTab(tabId)
    }
  }

  const renderTabContent = () => {
    try {
      switch (activeTab) {
        case 'general':
          return <GeneralTab vscode={vscode} />
        case 'debug':
          return <DebugTab vscode={vscode} />
        case 'docs':
          return <DocsTab vscode={vscode} />
        default:
          return <GeneralTab vscode={vscode} />
      }
    } catch (error) {
      console.error('Error rendering tab content:', error)
      return <div>Error loading tab: {String(error)}</div>
    }
  }

  // Add key to the outer container to force full re-render when refresh happens
  return (
    <div className='settings-layout' key={renderKey}>
      {/* Left Sidebar */}
      <div className='sidebar'>
        {tabs.map((tab, index) => (
          <div key={tab.id}>
            <button
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
              type='button'
            >
              <div className='tab-icon'>{tab.icon}</div>
              <span className='tab-label'>{tab.label}</span>
            </button>
            {index === 1 && <div className='separator' />}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className='content'>
        <div className='tab-content active'>{renderTabContent()}</div>
      </div>
    </div>
  )
}
