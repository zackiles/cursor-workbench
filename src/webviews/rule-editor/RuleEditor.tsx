import React, { useEffect, useState, useCallback, useRef } from 'react'
import type {
  AttachmentType,
  DocumentData,
  FrontmatterData,
  VSCodeAPI
} from '../../common/types'
import './RuleEditor.css'

interface RuleEditorProps {
  vscode: VSCodeAPI
}

export const RuleEditor = ({ vscode }: RuleEditorProps) => {
  const [content, setContent] = useState('')
  const [frontmatter, setFrontmatter] = useState<FrontmatterData>({
    attachmentType: 'manual' as AttachmentType,
    globs: '',
    description: '',
    notes: '',
    alwaysApply: false
  })
  const [filePath, setFilePath] = useState('')
  const [workspaceRoot, setWorkspaceRoot] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isNotesExpanded, setIsNotesExpanded] = useState(false)
  const [localStatus, setLocalStatus] = useState<'green' | 'yellow' | 'red'>(
    'green'
  )
  const [remoteStatus, setRemoteStatus] = useState<
    'green' | 'yellow' | 'red' | 'gray'
  >('green')

  // Add refs to track editor mounting and textarea
  const editorRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isUserTypingRef = useRef(false)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const localStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Create a stable logging function
  const logMessage = useCallback(
    (message: string, data?: unknown) => {
      vscode.postMessage({ type: 'log', message, data })
    },
    [vscode]
  )

  // Log component mount only once
  useEffect(() => {
    logMessage('RuleEditor component mounted')
  }, [logMessage])

  // Get status hover text
  const getStatusHoverText = useCallback(
    (type: 'remote' | 'local', status: 'green' | 'yellow' | 'red' | 'gray') => {
      const prefix = type === 'remote' ? 'Remote Status: ' : 'Local Status: '

      if (type === 'remote') {
        switch (status) {
          case 'green':
            return `${prefix}Clean`
          case 'yellow':
            return `${prefix}Commits to push`
          case 'red':
            return `${prefix}Uncommitted changes`
          case 'gray':
            return `${prefix}Disabled (no remote)`
          default:
            return `${prefix}Unknown`
        }
      } else {
        switch (status) {
          case 'green':
            return `${prefix}Saved`
          case 'yellow':
            return `${prefix}Unsaved changes`
          case 'red':
            return `${prefix}New file`
          default:
            return `${prefix}Unknown`
        }
      }
    },
    []
  )

  // Update local status when user types
  const updateLocalStatus = useCallback(() => {
    // Clear any existing timeout
    if (localStatusTimeoutRef.current) {
      clearTimeout(localStatusTimeoutRef.current)
    }

    // Set status to yellow (unsaved) immediately when typing
    if (isUserTypingRef.current) {
      setLocalStatus('yellow')
    }

    // After user stops typing for a bit, check if content matches saved state
    localStatusTimeoutRef.current = setTimeout(() => {
      // This is a simplified check - in a real implementation you'd compare with saved content
      // For now, we'll assume if user stopped typing, it's still unsaved until they save
      if (isUserTypingRef.current) {
        setLocalStatus('yellow')
      }
    }, 500)
  }, [])

  // Determine rule kind based on file path
  const getRuleKind = useCallback(
    (path: string): string => {
      if (!path || !workspaceRoot) return 'local'

      const relativePath = path.startsWith(workspaceRoot)
        ? path.slice(workspaceRoot.length).replace(/^[/\\]/, '')
        : path

      // Normalize path separators to forward slashes
      const normalizedPath = relativePath.replace(/\\/g, '/')

      // Check for team rules
      if (
        normalizedPath.startsWith('.cursor/rules/team/') ||
        normalizedPath.startsWith('.cursor/rules/global/') ||
        normalizedPath === '.cursor/rules/team' ||
        normalizedPath === '.cursor/rules/global'
      ) {
        return 'team'
      }

      // Check for user rules
      if (
        normalizedPath.startsWith('.cursor/rules/user/') ||
        normalizedPath.startsWith('.cursor/rules/local/') ||
        normalizedPath === '.cursor/rules/user' ||
        normalizedPath === '.cursor/rules/local'
      ) {
        return 'user'
      }

      // Check for project rules (in .cursor/rules but not in excluded folders)
      if (
        normalizedPath.startsWith('.cursor/rules/') ||
        normalizedPath === '.cursor/rules'
      ) {
        return 'project'
      }

      // Default fallback
      return 'local'
    },
    [workspaceRoot]
  )

  // Get filename without extension
  const getFileNameWithoutExtension = useCallback((path: string): string => {
    if (!path) return ''
    const fileName = path.split(/[/\\]/).pop() || ''
    const lastDotIndex = fileName.lastIndexOf('.')
    return lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName
  }, [])

  // Determine file format based on extension
  const getFileFormat = useCallback((path: string): string => {
    if (!path) return 'mdc'
    const fileName = path.split(/[/\\]/).pop() || ''
    const extension = fileName.split('.').pop()?.toLowerCase()

    switch (extension) {
      case 'rule':
      case 'mdc':
        return 'mdc'
      case 'yml':
      case 'yaml':
        return 'yml'
      case 'md':
      case 'markdown':
        return 'md'
      case 'json':
        return 'json'
      default:
        return 'mdc'
    }
  }, [])

  // Parse frontmatter and content from markdown
  const receiveDataFromBackend = useCallback(
    (data: DocumentData) => {
      // Set frontmatter from the parsed data
      setFrontmatter((prev) => {
        // Only log if there are significant changes
        if (
          data.attachmentType !== prev.attachmentType ||
          data.globs !== prev.globs
        ) {
          logMessage('Received updated frontmatter from backend', {
            attachmentType: data.attachmentType,
            globs: data.globs
          })
        }

        return {
          attachmentType: data.attachmentType || 'manual',
          globs: data.globs || '',
          description: data.description || '',
          notes: data.notes || '',
          alwaysApply:
            data.alwaysApply !== undefined
              ? data.alwaysApply
              : data.attachmentType === 'always',
          // Preserve any additional frontmatter fields
          ...data.frontmatter
        }
      })

      // Only update content if user is not actively typing
      const newContent = data.content || ''
      if (!isUserTypingRef.current) {
        setContent(newContent)
      }

      setIsLoading(false)
    },
    [logMessage]
  )

  // Handle frontmatter field changes
  const handleFrontmatterChange = useCallback(
    (field: keyof FrontmatterData, value: string | AttachmentType) => {
      const newFrontmatter = { ...frontmatter, [field]: value }

      // Update alwaysApply based on attachment type
      if (field === 'attachmentType') {
        if (value === 'always') {
          newFrontmatter.alwaysApply = true
        } else {
          newFrontmatter.alwaysApply = false
        }
      }

      setFrontmatter(newFrontmatter)

      // Update local status to show unsaved changes
      setLocalStatus('yellow')

      // Send updated document to VS Code
      vscode.postMessage({
        type: 'update',
        attachmentType: newFrontmatter.attachmentType,
        globs: newFrontmatter.globs,
        description: newFrontmatter.description,
        notes: newFrontmatter.notes,
        alwaysApply: newFrontmatter.alwaysApply,
        content,
        frontmatter: newFrontmatter
      })
    },
    [frontmatter, content, vscode]
  )

  // Handle content changes
  const handleContentChange = useCallback(
    (newContent: string) => {
      // Mark that user is actively typing
      isUserTypingRef.current = true

      setContent(newContent)

      // Update local status immediately
      updateLocalStatus()

      // Clear any existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      // Debounce VS Code updates to reduce message frequency
      updateTimeoutRef.current = setTimeout(() => {
        vscode.postMessage({
          type: 'update',
          attachmentType: frontmatter.attachmentType,
          globs: frontmatter.globs,
          description: frontmatter.description,
          notes: frontmatter.notes,
          alwaysApply: frontmatter.alwaysApply,
          content: newContent,
          frontmatter
        })

        // Clear typing flag after sending update and a small delay
        setTimeout(() => {
          isUserTypingRef.current = false
        }, 100)
      }, 300) // Increased debounce to 300ms for better stability
    },
    [frontmatter, vscode, updateLocalStatus]
  )

  // Handle settings button click
  const handleSettingsClick = useCallback(() => {
    vscode.postMessage({
      type: 'openSettings'
    })
  }, [vscode])

  // Handle remote status click
  const handleRemoteStatusClick = useCallback(() => {
    vscode.postMessage({
      type: 'remoteStatusClick',
      status: remoteStatus,
      filePath
    })
  }, [vscode, remoteStatus, filePath])

  const ruleKind = getRuleKind(filePath)
  const fileName = getFileNameWithoutExtension(filePath)
  const fileFormat = getFileFormat(filePath)

  // Listen for messages from VS Code
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      logMessage('Received message', message)

      if (message.type === 'update') {
        const data = message.data as DocumentData
        logMessage('Processing update message with data', data)

        setFilePath(data.filePath || '')
        setWorkspaceRoot(data.workspaceRoot || '')
        receiveDataFromBackend(data)
        setLocalStatus(data.localStatus || 'green')
        setRemoteStatus(data.remoteStatus || 'green')
        setIsLoading(false)
      }
    }

    window.addEventListener('message', handleMessage)

    // Request initial data only once
    logMessage('Requesting initial data from backend')
    vscode.postMessage({ type: 'ready' })

    return () => {
      window.removeEventListener('message', handleMessage)
      // Clean up any pending timeouts
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      if (localStatusTimeoutRef.current) {
        clearTimeout(localStatusTimeoutRef.current)
      }
    }
  }, [vscode, logMessage, receiveDataFromBackend])

  if (isLoading) {
    return <div className='loading'>Loading...</div>
  }

  return (
    <div className='rule-editor'>
      {/* Header with gears icon and rule information */}
      <div className='header-container'>
        {/* Gears icon and rule info */}
        <div className='rule-info'>
          <button
            type='button'
            className='gears-button'
            title='Rule Settings (Coming Soon)'
            onClick={handleSettingsClick}
          >
            <svg
              className='gears-icon'
              width='16'
              height='16'
              viewBox='0 0 24 24'
              fill='currentColor'
              aria-label='Settings icon'
            >
              <title>Settings icon</title>
              <path d='M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z' />
            </svg>
          </button>
          <div className='rule-details'>
            <div className='rule-info-line'>
              <strong>Rule: {fileName}</strong>
            </div>
            <div className='scope-info-line'>
              <code className='scope-info'>
                <strong>Scope:</strong> {ruleKind}{' '}
              </code>
              <code className='kind-info'>
                <strong>Kind:</strong> Cursor{' '}
              </code>
              <code className='format-info'>
                <strong>Format:</strong> {fileFormat}{' '}
              </code>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className='status-indicators'>
          <button
            type='button'
            className='status-item'
            title={getStatusHoverText('remote', remoteStatus)}
            onClick={handleRemoteStatusClick}
            aria-label={getStatusHoverText('remote', remoteStatus)}
          >
            <svg
              className='status-icon'
              width='14'
              height='14'
              viewBox='0 0 24 24'
              fill='currentColor'
              aria-hidden='true'
            >
              <path d='M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2M11,19.93C7.05,19.44 4,16.08 4,12C4,11.38 4.08,10.79 4.21,10.21L9,15V16A2,2 0 0,0 11,18M20.75,10.5C20.38,10.4 20,10.5 19.75,10.75L18.5,12L17,10.5C16.5,10 16.5,9.5 17,9L18.5,7.5L19.75,8.75C20.38,8.38 21,8.5 21,9V10C21,10.5 20.75,10.5 20.75,10.5M20.79,13.79C20.67,16.19 18.81,18.17 16.5,18.5L15,17H14V15L12,13V10L15,7H16.5C18.26,7 19.79,8.53 20.79,10.79C20.92,11.21 21,11.6 21,12C21,12.69 20.92,13.36 20.79,13.79Z' />
            </svg>
            <div className={`status-dot status-${remoteStatus}`} />
          </button>
          <div
            className='status-item'
            title={getStatusHoverText('local', localStatus)}
          >
            <svg
              className='status-icon'
              width='14'
              height='14'
              viewBox='0 0 24 24'
              fill='currentColor'
              aria-hidden='true'
            >
              <path d='M4,6H20V16H4M20,18A2,2 0 0,0 22,16V6C22,4.89 21.1,4 20,4H4C2.89,4 2,4.89 2,6V16A2,2 0 0,0 4,18H11V20H8V22H16V20H13V18H20Z' />
            </svg>
            <div className={`status-dot status-${localStatus}`} />
          </div>
        </div>
      </div>

      {/* Frontmatter Form Fields */}
      <div className='frontmatter-form'>
        <div className='form-row'>
          <label htmlFor='attachment-type'>Attachment Type</label>
          <div className='select-wrapper'>
            <select
              id='attachment-type'
              value={frontmatter.attachmentType || 'manual'}
              onChange={(e) =>
                handleFrontmatterChange(
                  'attachmentType',
                  e.target.value as AttachmentType
                )
              }
              className='form-select'
            >
              <option value='always'>Always</option>
              <option value='auto'>Auto</option>
              <option value='agent'>Agent</option>
              <option value='manual'>Manual</option>
            </select>
          </div>
        </div>

        {frontmatter.attachmentType === 'auto' && (
          <div className='form-row form-row-flex'>
            <label htmlFor='globs'>File Patterns (Globs)</label>
            <input
              id='globs'
              type='text'
              value={frontmatter.globs}
              onChange={(e) => handleFrontmatterChange('globs', e.target.value)}
              placeholder='e.g., **/*.tsx, src/**/*.js'
              className='form-input'
            />
          </div>
        )}

        {frontmatter.attachmentType === 'agent' && (
          <div className='form-row form-row-flex'>
            <label htmlFor='description'>Description</label>
            <input
              id='description'
              type='text'
              value={frontmatter.description}
              onChange={(e) =>
                handleFrontmatterChange('description', e.target.value)
              }
              placeholder='When should the agent use the rule?'
              className='form-input'
            />
          </div>
        )}
      </div>

      {/* Notes Section with Expand/Collapse */}
      <div className='notes-section'>
        <button
          type='button'
          className='notes-toggle'
          onClick={() => setIsNotesExpanded(!isNotesExpanded)}
          aria-expanded={isNotesExpanded}
          aria-controls='notes-content'
        >
          <svg
            className={`chevron-icon ${isNotesExpanded ? 'expanded' : ''}`}
            width='12'
            height='12'
            viewBox='0 0 24 24'
            fill='currentColor'
            aria-hidden='true'
          >
            <path d='M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z' />
          </svg>
          <span>Notes</span>
        </button>

        {isNotesExpanded && (
          <div id='notes-content' className='notes-content'>
            <textarea
              id='notes-textarea'
              value={frontmatter.notes}
              onChange={(e) => handleFrontmatterChange('notes', e.target.value)}
              placeholder='Add notes or additional context for this rule...'
              className='notes-textarea'
              rows={3}
            />
          </div>
        )}
      </div>

      {/* Content Editor */}
      <div className='content-editor'>
        {process.env.NODE_ENV === 'development' && (
          <div
            style={{
              fontSize: '10px',
              color: 'var(--vscode-descriptionForeground)',
              marginBottom: '8px'
            }}
          >
            Debug: isLoading={String(isLoading)}, contentLength={content.length}
            , content={content ? 'has content' : 'no content'}
          </div>
        )}
        {isLoading ? (
          <div style={{ padding: '20px', color: 'var(--vscode-foreground)' }}>
            Loading editor...
          </div>
        ) : (
          <div ref={editorRef}>
            <textarea
              ref={textareaRef}
              className='content-textarea'
              value={content}
              onChange={(e) => {
                handleContentChange(e.target.value)
              }}
              placeholder='Describe the tasks this rule is helpful for, tag files with @'
            />
          </div>
        )}
      </div>
    </div>
  )
}
