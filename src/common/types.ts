export interface VSCodeAPI {
  postMessage: (message: unknown) => void
}

export interface DocumentData {
  rule: string
  globs: string
  content: string
  filePath?: string
  workspaceRoot?: string
}

export interface FrontmatterData {
  rule: string
  globs: string
  description: string
  notes: string
}

export interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'debug' | 'warn' | 'error'
  message: string
  data?: unknown
}

export interface ExtensionInfo {
  id: string
  isBuiltin: boolean
  path: string
  exports: string[]
  packageInfo?: unknown
}

export interface ExtensionInfoResponse {
  cursorExtensions: ExtensionInfo[]
  allExtensions: ExtensionInfo[]
}

export interface RegistryState {
  userRegistry: string | null
  teamRegistry: string | null
  userRegistryFileCount?: number
  teamRegistryFileCount?: number
}
