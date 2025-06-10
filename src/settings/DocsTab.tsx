import React from 'react'

interface VSCodeAPI {
  postMessage: (message: unknown) => void
}

interface DocsTabProps {
  vscode: VSCodeAPI
}

export const DocsTab = ({ vscode }: DocsTabProps) => {
  return (
    <div>
      <div className="content-header">
        <h1 className="content-title">Documentation</h1>
      </div>
      <div className="placeholder-text">
        Documentation and help content coming soon!
      </div>
    </div>
  )
}
