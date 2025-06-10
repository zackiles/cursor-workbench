import { createRoot } from 'react-dom/client'
import { RuleEditor } from './RuleEditor'
import { Settings } from '../settings'

// VS Code API
interface VSCodeAPI {
  postMessage: (message: unknown) => void
}

declare const acquireVsCodeApi: () => VSCodeAPI

// Global variable set by the webview provider
declare global {
  interface Window {
    WEBVIEW_TYPE?: 'rule-editor' | 'settings'
  }
}

const vscode = acquireVsCodeApi()

// Determine which component to render based on global variable
const getComponentType = (): 'rule-editor' | 'settings' => {
  return window.WEBVIEW_TYPE || 'rule-editor'
}

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  const componentType = getComponentType()

  console.log('Webview loading with type:', componentType)

  try {
    if (componentType === 'settings') {
      console.log('Rendering Settings component')
      root.render(<Settings vscode={vscode} />)
    } else {
      console.log('Rendering RuleEditor component')
      root.render(<RuleEditor vscode={vscode} />)
    }
  } catch (error) {
    console.error('Error rendering component:', error)
    root.render(<div>Error loading component: {String(error)}</div>)
  }
} else {
  console.error('Root container not found!')
}
