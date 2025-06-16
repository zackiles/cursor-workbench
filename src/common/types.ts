export interface VSCodeAPI {
  postMessage: (message: unknown) => void
}

export enum AttachmentType {
  AlwaysAttached = 'always',
  AutoAttached = 'auto',
  AgentAttached = 'agent',
  ManuallyAttached = 'manual',
  Invalid = 'invalid' // Combination of frontmatter fields is invalid
}

export interface DetailedFileStatus {
  localStatus: 'modified' | 'unmodified' | 'untracked'
  remoteStatus: 'ahead' | 'behind' | 'diverged' | 'up-to-date' | 'no-remote'
  hasUnstagedChanges: boolean
  hasUncommittedChanges: boolean
  lastCommitHash?: string
  remoteCommitHash?: string
  commitMessage?: string
}

export interface DocumentData {
  attachmentType: AttachmentType
  globs: string
  description: string
  notes: string
  alwaysApply: boolean
  content: string
  filePath?: string
  workspaceRoot?: string
  localStatus?: 'green' | 'yellow' | 'red'
  remoteStatus?: 'green' | 'yellow' | 'red' | 'gray'
  detailedStatus?: DetailedFileStatus
  frontmatter?: Record<string, unknown>
}

export interface FrontmatterData {
  attachmentType: AttachmentType
  globs: string
  description: string
  notes: string
  alwaysApply: boolean
  [key: string]: unknown
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

export interface EditorSettings {
  isDefaultRuleEditor: boolean
  enabledExtensions: string[]
}

export interface SettingsState extends RegistryState {
  editorSettings: EditorSettings
}

/**
 * Determines the attachment type based on frontmatter content
 *
 * @param frontmatter - Parsed frontmatter object
 * @returns The detected attachment type
 */
export function determineAttachmentType(
  frontmatter: Record<string, unknown> | null
): AttachmentType {
  if (!frontmatter) {
    // No frontmatter typically implies ManuallyAttached if the file contains content
    // Linter rules should handle empty files separately if needed.
    // Assuming content exists, default to ManuallyAttached or rely on caller context.
    return AttachmentType.ManuallyAttached
  }

  const hasGlobs = 'globs' in frontmatter
  const hasAlwaysApply = 'alwaysApply' in frontmatter
  const hasDescription = 'description' in frontmatter

  const globsValue = frontmatter.globs
  const alwaysApplyValue = frontmatter.alwaysApply
  const descriptionValue = frontmatter.description

  // Check for empty values
  const isGlobsEmpty =
    !globsValue ||
    (typeof globsValue === 'string' && globsValue.trim() === '') ||
    (Array.isArray(globsValue) && globsValue.length === 0)

  const isDescriptionEmpty =
    !descriptionValue ||
    (typeof descriptionValue === 'string' && descriptionValue.trim() === '')

  // Rule categorization based on frontmatter fields and values

  // AlwaysAttached: alwaysApply: true
  if (hasAlwaysApply && alwaysApplyValue === true) {
    return AttachmentType.AlwaysAttached
  }

  // AgentAttached: non-empty description, and either no globs or empty globs
  if (hasDescription && !isDescriptionEmpty) {
    return AttachmentType.AgentAttached
  }

  // AutoAttached: alwaysApply: false, non-empty globs
  if (
    hasAlwaysApply &&
    alwaysApplyValue === false &&
    hasGlobs &&
    !isGlobsEmpty
  ) {
    return AttachmentType.AutoAttached
  }

  // ManuallyAttached: alwaysApply: false, empty or no globs, empty or no description
  if (
    hasAlwaysApply &&
    alwaysApplyValue === false &&
    (!hasGlobs || isGlobsEmpty) &&
    (!hasDescription || isDescriptionEmpty)
  ) {
    return AttachmentType.ManuallyAttached
  }

  // Invalid combinations
  return AttachmentType.Invalid
}
