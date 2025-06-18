import * as vscode from 'vscode'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import * as crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { logger } from './logger'
import { configManager } from './configManager'

export interface TeamRegistry {
  url: string
  storageLocation: string
  files: string[]
}

export type FileStatus = 'modified' | 'unmodified' | 'untracked'

export interface DetailedFileStatus {
  localStatus: 'modified' | 'unmodified' | 'untracked'
  remoteStatus: 'ahead' | 'behind' | 'diverged' | 'up-to-date' | 'no-remote'
  hasUnstagedChanges: boolean
  hasUncommittedChanges: boolean
  lastCommitHash?: string
  remoteCommitHash?: string
  commitMessage?: string
}

class RegistryManager {
  private teamRegistry: TeamRegistry | null = null
  private context: vscode.ExtensionContext | null = null
  private onRegistryChanged: ((registry: TeamRegistry | null) => void)[] = []
  private readonly TEAM_REGISTRY_KEY_PREFIX = 'cursorWorkbenchTeamRegistry'

  async initialize(context: vscode.ExtensionContext) {
    this.context = context

    // Load persisted team registry state
    await this.loadPersistedState()

    logger.log('Registry manager initialized', {
      hasPersistedRegistry: !!this.teamRegistry,
      registryUrl: this.teamRegistry?.url
    })
  }

  private getProjectSpecificKey(): string {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!workspaceRoot) {
      throw new Error('No project folder found for registry key')
    }

    // Create a hash of the project path for a unique but consistent key
    const projectHash = crypto
      .createHash('md5')
      .update(workspaceRoot)
      .digest('hex')
      .slice(0, 8)
    return `${this.TEAM_REGISTRY_KEY_PREFIX}_${projectHash}`
  }

  private async loadPersistedState(): Promise<void> {
    if (!this.context) return

    try {
      const projectKey = this.getProjectSpecificKey()
      const persistedState =
        this.context.globalState.get<TeamRegistry>(projectKey)

      if (persistedState) {
        // Verify that the storage location still exists
        if (fs.existsSync(persistedState.storageLocation)) {
          this.teamRegistry = persistedState
          logger.log('Restored team registry from persisted state', {
            url: persistedState.url,
            storageLocation: persistedState.storageLocation,
            fileCount: persistedState.files.length,
            projectKey
          })

          // Check if symlinks need to be recreated (e.g., after VSCode reload)
          await this.ensureSymlinksExist()

          // Notify listeners that registry was restored
          this.notifyRegistryChanged()
        } else {
          // Storage location missing, clear invalid state
          logger.log('Persisted registry storage missing, clearing state', {
            expectedLocation: persistedState.storageLocation,
            projectKey
          })
          await this.clearPersistedState()
        }
      }
    } catch (error) {
      logger.log('Error loading persisted registry state', error)
      await this.clearPersistedState()
    }
  }

  private async persistState(): Promise<void> {
    if (!this.context) return

    try {
      const projectKey = this.getProjectSpecificKey()
      if (this.teamRegistry) {
        await this.context.globalState.update(projectKey, this.teamRegistry)
        logger.log('Team registry state persisted for project', { projectKey })
      } else {
        await this.clearPersistedState()
      }
    } catch (error) {
      logger.log('Error persisting registry state', error)
    }
  }

  private async clearPersistedState(): Promise<void> {
    if (!this.context) return

    try {
      const projectKey = this.getProjectSpecificKey()
      await this.context.globalState.update(projectKey, undefined)
      logger.log('Team registry persisted state cleared for project', {
        projectKey
      })
    } catch (error) {
      logger.log('Error clearing persisted registry state', error)
    }
  }

  private async ensureSymlinksExist(): Promise<void> {
    if (!this.teamRegistry) return

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!workspaceRoot) {
      logger.log('No workspace folder found for symlink verification')
      return
    }

    const registryPath = path.join(
      this.teamRegistry.storageLocation,
      'repo',
      '.cursor'
    )
    let missingSymlinks = 0
    let recreatedSymlinks = 0

    logger.log('RESTORE: Verifying symlinks exist for restored registry...', {
      registryPath,
      workspaceRoot,
      totalFiles: this.teamRegistry.files.length
    })

    for (const file of this.teamRegistry.files) {
      const targetPath = path.join(workspaceRoot, file)
      const sourcePath = path.join(registryPath, path.relative('.cursor', file))

      logger.log('RESTORE: Checking registry file symlink', {
        file,
        targetPath,
        sourcePath
      })

      try {
        if (!fs.existsSync(targetPath)) {
          // Symlink is missing, recreate it
          const targetDir = path.dirname(targetPath)
          logger.log('RESTORE: Creating missing symlink', {
            targetPath,
            targetDir
          })
          await fs.promises.mkdir(targetDir, { recursive: true })
          await fs.promises.symlink(sourcePath, targetPath)
          recreatedSymlinks++
          logger.log('RESTORE: Successfully recreated missing symlink', {
            targetPath,
            sourcePath,
            relativePath: file
          })
        } else {
          // Check if it's still a valid symlink pointing to the right place
          const stats = await fs.promises.lstat(targetPath)
          logger.log('RESTORE: Target exists, checking type', {
            targetPath,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            isSymbolicLink: stats.isSymbolicLink()
          })

          if (stats.isSymbolicLink()) {
            const currentTarget = fs.readlinkSync(targetPath)
            if (currentTarget !== sourcePath) {
              // Symlink points to wrong location, fix it
              logger.log('RESTORE: Fixing incorrect symlink target', {
                targetPath,
                currentTarget,
                expectedTarget: sourcePath
              })
              await fs.promises.unlink(targetPath)
              await fs.promises.symlink(sourcePath, targetPath)
              recreatedSymlinks++
              logger.log('RESTORE: Fixed incorrect symlink target', {
                targetPath,
                oldTarget: currentTarget,
                newTarget: sourcePath,
                relativePath: file
              })
            } else {
              logger.log('RESTORE: Symlink is correct, no action needed', {
                targetPath
              })
            }
          } else if (stats.isFile()) {
            // Real file exists, don't replace it
            logger.log(
              'RESTORE: Real file exists, preserving it (deep-merge behavior)',
              {
                targetPath,
                relativePath: file
              }
            )
          }
        }
      } catch (error) {
        missingSymlinks++
        logger.log('RESTORE: Error verifying/recreating symlink', {
          file,
          targetPath,
          sourcePath,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    logger.log('RESTORE: Symlink verification complete', {
      totalFiles: this.teamRegistry.files.length,
      recreatedSymlinks,
      missingSymlinks
    })
  }

  onDidChangeRegistry(callback: (registry: TeamRegistry | null) => void) {
    this.onRegistryChanged.push(callback)
  }

  private notifyRegistryChanged() {
    for (const callback of this.onRegistryChanged) {
      callback(this.teamRegistry)
    }
  }

  async addTeamRegistry(gitUrl: string): Promise<void> {
    if (!this.context) {
      throw new Error('Registry manager not initialized')
    }

    try {
      logger.log('Adding team registry', { gitUrl })

      // Remove existing registry if any
      await this.removeTeamRegistry()

      // Create storage location
      const storageUri = this.context.storageUri
      if (!storageUri) {
        throw new Error('Extension storage not available')
      }

      const storageLocation = path.join(storageUri.fsPath, 'team-registry')
      await fs.promises.mkdir(storageLocation, { recursive: true })

      // Clone repository with sparse checkout directly to storage
      await this.cloneRepositoryWithSparseCheckout(gitUrl, storageLocation)

      // Get list of files in the registry
      const cursorPath = path.join(storageLocation, 'repo', '.cursor')
      const files = await this.getRegistryFiles(cursorPath)

      // Create symlinks to project
      await this.createSymlinks(cursorPath, files)

      // Update registry state
      this.teamRegistry = {
        url: gitUrl,
        storageLocation,
        files
      }

      // Persist state to survive VSCode reloads
      await this.persistState()

      logger.log('Team registry added successfully', {
        url: gitUrl,
        storageLocation,
        fileCount: files.length
      })

      this.notifyRegistryChanged()

      // Add to .gitignore
      await this.addToGitignore()
    } catch (error) {
      logger.log('Error adding team registry', { gitUrl, error })
      throw error
    }
  }

  async removeTeamRegistry(): Promise<void> {
    if (!this.teamRegistry || !this.context) {
      logger.log('No team registry to remove')
      return
    }

    const registryUrl = this.teamRegistry.url
    const storageLocation = this.teamRegistry.storageLocation
    const files = [...this.teamRegistry.files] // Copy array for logging

    try {
      logger.log('Removing team registry', {
        url: registryUrl,
        storageLocation,
        fileCount: files.length
      })

      // Remove symlinks from project first
      logger.log('Removing symlinks from project...')
      await this.removeSymlinks(files)

      // Clear extension storage directory completely
      logger.log('Clearing extension storage directory...')
      if (fs.existsSync(storageLocation)) {
        await this.removeDirectory(storageLocation)
        logger.log('Extension storage directory cleared', { storageLocation })
      } else {
        logger.log('Extension storage directory already missing', {
          storageLocation
        })
      }

      // Clear in-memory state
      this.teamRegistry = null

      // Clear persisted state from VSCode workspace storage
      logger.log('Clearing persisted state from VSCode storage...')
      await this.clearPersistedState()

      // Notify listeners that registry was removed
      this.notifyRegistryChanged()

      // Remove from .gitignore
      await this.removeFromGitignore()

      logger.log('Team registry removed successfully', {
        url: registryUrl,
        removedFiles: files.length
      })
    } catch (error) {
      logger.log('Error removing team registry', {
        url: registryUrl,
        storageLocation,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  getTeamRegistry(): TeamRegistry | null {
    return this.teamRegistry
  }

  async getDetailedFileStatus(rulePath: string): Promise<DetailedFileStatus> {
    if (!this.teamRegistry) {
      throw new Error('No team registry available')
    }

    const repoPath = path.join(this.teamRegistry.storageLocation, 'repo')
    const repoRelativePath = path.relative('.cursor', rulePath)
    const fullRepoPath = path.join('.cursor', repoRelativePath)

    try {
      // Get local file status (staged/unstaged changes)
      const statusOutput = await this.executeGitCommandDirect('git', [
        '-C',
        repoPath,
        'status',
        '--porcelain',
        '--',
        fullRepoPath
      ])

      let localStatus: 'modified' | 'unmodified' | 'untracked' = 'unmodified'
      let hasUnstagedChanges = false
      let hasUncommittedChanges = false

      if (statusOutput.trim() !== '') {
        const statusCode = statusOutput.trim().substring(0, 2)

        // Check for untracked files
        if (statusCode === '??') {
          localStatus = 'untracked'
          hasUnstagedChanges = true
        } else {
          // Check index status (first character)
          if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
            hasUncommittedChanges = true
            localStatus = 'modified'
          }

          // Check working tree status (second character)
          if (statusCode[1] !== ' ' && statusCode[1] !== '?') {
            hasUnstagedChanges = true
            localStatus = 'modified'
          }
        }
      }

      // Get remote tracking information
      let remoteStatus:
        | 'ahead'
        | 'behind'
        | 'diverged'
        | 'up-to-date'
        | 'no-remote' = 'no-remote'
      let lastCommitHash: string | undefined
      let remoteCommitHash: string | undefined

      try {
        // Get current branch
        const currentBranch = await this.executeGitCommandDirect('git', [
          '-C',
          repoPath,
          'rev-parse',
          '--abbrev-ref',
          'HEAD'
        ])

        const branch = currentBranch.trim()

        // Get remote tracking branch
        const remoteBranch = await this.executeGitCommandDirect('git', [
          '-C',
          repoPath,
          'rev-parse',
          '--abbrev-ref',
          `${branch}@{upstream}`
        ]).catch(() => null)

        if (remoteBranch) {
          const remote = remoteBranch.trim()

          // Get local and remote commit hashes
          lastCommitHash = (
            await this.executeGitCommandDirect('git', [
              '-C',
              repoPath,
              'rev-parse',
              'HEAD'
            ])
          ).trim()

          remoteCommitHash = (
            await this.executeGitCommandDirect('git', [
              '-C',
              repoPath,
              'rev-parse',
              remote
            ])
          ).trim()

          // Check ahead/behind status
          const aheadBehind = await this.executeGitCommandDirect('git', [
            '-C',
            repoPath,
            'rev-list',
            '--left-right',
            '--count',
            `${remote}...HEAD`
          ])

          const [behind, ahead] = aheadBehind.trim().split('\t').map(Number)

          if (ahead > 0 && behind > 0) {
            remoteStatus = 'diverged'
          } else if (ahead > 0) {
            remoteStatus = 'ahead'
          } else if (behind > 0) {
            remoteStatus = 'behind'
          } else {
            remoteStatus = 'up-to-date'
          }
        }
      } catch (error) {
        logger.log('Could not determine remote status', { error })
        remoteStatus = 'no-remote'
      }

      // Get last commit message for this file
      let commitMessage: string | undefined
      try {
        const logOutput = await this.executeGitCommandDirect('git', [
          '-C',
          repoPath,
          'log',
          '-1',
          '--pretty=format:%s',
          '--',
          fullRepoPath
        ])
        commitMessage = logOutput.trim() || undefined
      } catch (error) {
        logger.log('Could not get last commit message', { error })
      }

      return {
        localStatus,
        remoteStatus,
        hasUnstagedChanges,
        hasUncommittedChanges,
        lastCommitHash,
        remoteCommitHash,
        commitMessage
      }
    } catch (error) {
      logger.log('Error getting detailed file status', {
        rulePath,
        repoPath,
        error: error instanceof Error ? error.message : String(error)
      })

      // Return default status on error
      return {
        localStatus: 'unmodified',
        remoteStatus: 'no-remote',
        hasUnstagedChanges: false,
        hasUncommittedChanges: false
      }
    }
  }

  async stageAndCommitFile(
    rulePath: string,
    commitMessage: string
  ): Promise<void> {
    if (!this.teamRegistry) {
      throw new Error('No team registry available')
    }

    const repoPath = path.join(this.teamRegistry.storageLocation, 'repo')
    const repoRelativePath = path.relative('.cursor', rulePath)
    const fullRepoPath = path.join('.cursor', repoRelativePath)

    try {
      // Stage the specific file
      await this.executeGitCommandDirect('git', [
        '-C',
        repoPath,
        'add',
        fullRepoPath
      ])

      // Commit the staged changes
      await this.executeGitCommandDirect('git', [
        '-C',
        repoPath,
        'commit',
        '-m',
        commitMessage
      ])

      logger.log('Successfully staged and committed file', {
        rulePath,
        fullRepoPath,
        commitMessage
      })
    } catch (error) {
      logger.log('Error staging and committing file', {
        rulePath,
        fullRepoPath,
        commitMessage,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  async pushChanges(): Promise<void> {
    if (!this.teamRegistry) {
      throw new Error('No team registry available')
    }

    const repoPath = path.join(this.teamRegistry.storageLocation, 'repo')

    try {
      // Push to remote
      await this.executeGitCommandDirect('git', ['-C', repoPath, 'push'])

      logger.log('Successfully pushed changes to remote')
    } catch (error) {
      logger.log('Error pushing changes', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  async pullChanges(): Promise<void> {
    if (!this.teamRegistry) {
      throw new Error('No team registry available')
    }

    const repoPath = path.join(this.teamRegistry.storageLocation, 'repo')

    try {
      // Fetch latest changes
      await this.executeGitCommandDirect('git', ['-C', repoPath, 'fetch'])

      // Pull changes (this will merge or rebase depending on git config)
      await this.executeGitCommandDirect('git', ['-C', repoPath, 'pull'])

      logger.log('Successfully pulled changes from remote')
    } catch (error) {
      logger.log('Error pulling changes', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  async fetchAndRebaseThenPush(): Promise<void> {
    if (!this.teamRegistry) {
      throw new Error('No team registry available')
    }

    const repoPath = path.join(this.teamRegistry.storageLocation, 'repo')

    try {
      // Fetch latest changes
      await this.executeGitCommandDirect('git', ['-C', repoPath, 'fetch'])

      // Rebase local changes on top of remote
      await this.executeGitCommandDirect('git', ['-C', repoPath, 'rebase'])

      // Push the rebased changes
      await this.executeGitCommandDirect('git', ['-C', repoPath, 'push'])

      logger.log('Successfully fetched, rebased, and pushed changes')
    } catch (error) {
      logger.log('Error during fetch/rebase/push', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  async getFileStatus(rulePath: string): Promise<FileStatus> {
    if (!this.teamRegistry) {
      throw new Error('No team registry available')
    }

    const repoPath = path.join(this.teamRegistry.storageLocation, 'repo')

    try {
      // Convert workspace-relative path to repo-relative path
      const repoRelativePath = path.relative('.cursor', rulePath)
      const fullRepoPath = path.join('.cursor', repoRelativePath)

      const stdout = await this.executeGitCommandDirect('git', [
        '-C',
        repoPath,
        'status',
        '--porcelain',
        '--',
        fullRepoPath
      ])

      if (stdout.trim() === '') {
        return 'unmodified'
      }

      const statusCode = stdout.trim().substring(0, 2)

      // Check for modified files (M in index or working tree)
      if (statusCode.includes('M')) {
        return 'modified'
      }

      // Check for untracked files
      if (statusCode === '??') {
        return 'untracked'
      }

      return 'unmodified'
    } catch (error) {
      logger.log('Error checking file status', {
        rulePath,
        repoPath,
        error: error instanceof Error ? error.message : String(error)
      })
      // If we can't determine status, assume unmodified
      return 'unmodified'
    }
  }

  async refreshFileDecorations(): Promise<void> {
    // This method can be called to trigger a refresh of file decorations
    // It's useful when we know files might have changed status
    this.notifyRegistryChanged()
  }

  async getAllFileStatuses(): Promise<Map<string, FileStatus>> {
    const statusMap = new Map<string, FileStatus>()

    if (!this.teamRegistry) {
      return statusMap
    }

    // Get status for all registry files
    for (const file of this.teamRegistry.files) {
      try {
        const status = await this.getFileStatus(file)
        statusMap.set(file, status)
      } catch (error) {
        logger.log('Error getting status for file', { file, error })
        statusMap.set(file, 'unmodified')
      }
    }

    return statusMap
  }

  private async executeGitCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Parse command properly to handle quoted arguments
      const args = this.parseCommandArgs(command)
      const [cmd, ...cmdArgs] = args

      const git = spawn(cmd, cmdArgs, { stdio: 'pipe' })

      let stdout = ''
      let stderr = ''

      git.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      git.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`Git command failed with code ${code}: ${stderr}`))
        }
      })

      git.on('error', (error) => {
        reject(new Error(`Git command failed: ${error.message}`))
      })
    })
  }

  private parseCommandArgs(command: string): string[] {
    const args: string[] = []
    let current = ''
    let inQuotes = false
    let quoteChar = ''

    for (let i = 0; i < command.length; i++) {
      const char = command[i]

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true
        quoteChar = char
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false
        quoteChar = ''
      } else if (!inQuotes && char === ' ') {
        if (current.trim()) {
          args.push(current.trim())
          current = ''
        }
      } else {
        current += char
      }
    }

    if (current.trim()) {
      args.push(current.trim())
    }

    return args
  }

  private async cloneRepositoryWithSparseCheckout(
    gitUrl: string,
    storageLocation: string
  ): Promise<void> {
    const repoPath = path.join(storageLocation, 'repo')

    try {
      logger.log('Cloning repository with sparse checkout', {
        gitUrl,
        repoPath
      })

      // Step 1: Clone without checking out files
      await this.executeGitCommandDirect('git', [
        'clone',
        '--no-checkout',
        gitUrl,
        repoPath
      ])

      // Step 2: Configure sparse checkout
      await this.executeGitCommandDirect('git', [
        '-C',
        repoPath,
        'sparse-checkout',
        'set',
        '.cursor'
      ])

      // Step 3: Get the default branch
      const defaultBranch = await this.getDefaultBranch(repoPath)

      // Step 4: Checkout the main branch to populate only .cursor directory
      await this.executeGitCommandDirect('git', [
        '-C',
        repoPath,
        'checkout',
        defaultBranch
      ])

      // Verify .cursor directory exists
      const cursorPath = path.join(repoPath, '.cursor')
      if (!fs.existsSync(cursorPath)) {
        throw new Error(
          'No .cursor folder found in repository after sparse checkout'
        )
      }

      logger.log('Repository cloned successfully with sparse checkout', {
        gitUrl,
        repoPath,
        cursorPath
      })
    } catch (error) {
      logger.log('Error during sparse checkout clone', {
        gitUrl,
        repoPath,
        error
      })
      // Clean up partial clone on failure
      if (fs.existsSync(repoPath)) {
        await this.removeDirectory(repoPath)
      }
      throw error
    }
  }

  private async executeGitCommandDirect(
    command: string,
    args: string[]
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn(command, args, { stdio: 'pipe' })

      let stdout = ''
      let stderr = ''

      git.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      git.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`Git command failed with code ${code}: ${stderr}`))
        }
      })

      git.on('error', (error) => {
        reject(new Error(`Git command failed: ${error.message}`))
      })
    })
  }

  private async getDefaultBranch(repoPath: string): Promise<string> {
    const branch = await this.executeGitCommandDirect("git", [
      "-C",
      repoPath,
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
    ]);
    return branch.trim().split("/").pop() || "main";
  }

  private async removeDirectory(dirPath: string): Promise<void> {
    if (fs.existsSync(dirPath)) {
      await fs.promises.rm(dirPath, { recursive: true, force: true })
    }
  }

  private async getRegistryFiles(cursorPath: string): Promise<string[]> {
    const files: string[] = []

    const scanDirectory = async (dirPath: string, relativePath = '') => {
      const entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true
      })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        const relativeFilePath = path.join(relativePath, entry.name)

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await scanDirectory(fullPath, relativeFilePath)
        } else if (this.isRuleFile(entry.name)) {
          // Store as relative path from project root - normalize path separators
          const normalizedPath = path
            .join('.cursor', relativeFilePath)
            .replace(/\\/g, '/')
          files.push(normalizedPath)
          logger.log('Found registry file', {
            fullPath,
            relativePath: normalizedPath
          })
        }
      }
    }

    await scanDirectory(cursorPath)
    logger.log('Registry file scan complete', {
      totalFiles: files.length,
      files
    })
    return files
  }

  private async createSymlinks(
    registryPath: string,
    files: string[]
  ): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!workspaceRoot) {
      throw new Error('No workspace folder found')
    }

    logger.log('Creating symlinks for registry files', {
      registryPath,
      workspaceRoot,
      totalFiles: files.length,
      files
    })

    for (const file of files) {
      const sourcePath = path.join(registryPath, path.relative('.cursor', file))
      const targetPath = path.join(workspaceRoot, file)
      const targetDir = path.dirname(targetPath)

      logger.log('Processing registry file for symlink creation', {
        file,
        sourcePath,
        targetPath,
        targetDir
      })

      try {
        // Ensure target directory exists - this should work even if parent dirs exist
        logger.log('Creating target directory structure', { targetDir })
        await fs.promises.mkdir(targetDir, { recursive: true })
        logger.log('Target directory structure created successfully', {
          targetDir
        })

        // Check if target file already exists (not directory!)
        if (fs.existsSync(targetPath)) {
          const stats = await fs.promises.lstat(targetPath)
          logger.log('Target path exists, checking type', {
            targetPath,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            isSymbolicLink: stats.isSymbolicLink()
          })

          if (stats.isSymbolicLink()) {
            // Replace existing symlink
            await fs.promises.unlink(targetPath)
            logger.log('Replaced existing symlink', { targetPath })
          } else if (stats.isFile()) {
            // Don't replace real files - this is critical for deep-merge behavior
            logger.log(
              'DEEP-MERGE: Skipping symlink creation - real file exists (preserving local file)',
              {
                targetPath,
                relativePath: file
              }
            )
            continue
          } else if (stats.isDirectory()) {
            // This shouldn't happen for files, but log it
            logger.log('ERROR: Target path is a directory, not a file', {
              targetPath,
              relativePath: file
            })
            continue
          }
        } else {
          logger.log('Target file does not exist, will create symlink', {
            targetPath
          })
        }

        // Verify source file exists before creating symlink
        if (!fs.existsSync(sourcePath)) {
          logger.log(
            'ERROR: Source file does not exist, cannot create symlink',
            {
              sourcePath,
              targetPath,
              relativePath: file
            }
          )
          continue
        }

        // Create symlink for the individual file
        await fs.promises.symlink(sourcePath, targetPath)
        logger.log('SUCCESS: Created symlink for registry file', {
          sourcePath,
          targetPath,
          relativePath: file
        })
      } catch (error) {
        logger.log('ERROR: Failed to create symlink', {
          file,
          sourcePath,
          targetPath,
          targetDir,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
      }
    }

    logger.log('Symlink creation complete', {
      totalFiles: files.length
    })
  }

  private async removeSymlinks(files: string[]): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!workspaceRoot) {
      return
    }

    for (const file of files) {
      const targetPath = path.join(workspaceRoot, file)

      try {
        if (fs.existsSync(targetPath)) {
          const stats = await fs.promises.lstat(targetPath)
          if (stats.isSymbolicLink()) {
            await fs.promises.unlink(targetPath)
            logger.log('Removed symlink during cleanup', {
              targetPath,
              relativePath: file
            })
          } else if (stats.isFile()) {
            logger.log('Preserving real file during cleanup', {
              targetPath,
              relativePath: file
            })
          } else if (stats.isDirectory()) {
            logger.log(
              'Warning: Expected file but found directory during cleanup',
              {
                targetPath,
                relativePath: file
              }
            )
          }
        } else {
          logger.log('Symlink already removed or never existed', {
            targetPath,
            relativePath: file
          })
        }
      } catch (error) {
        logger.log('Error removing symlink during cleanup', {
          file,
          targetPath,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    logger.log('Symlink cleanup complete', {
      processedFiles: files.length
    })
  }

  private isRuleFile(fileName: string): boolean {
    return configManager.isRuleFile(fileName)
  }

  private async isGitRepository(): Promise<boolean> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!workspaceRoot) {
      return false
    }

    const gitPath = path.join(workspaceRoot, '.git')
    try {
      const stats = await fs.promises.stat(gitPath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  private async addToGitignore(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!workspaceRoot) {
      return
    }

    // Only proceed if this is a git repository
    if (!(await this.isGitRepository())) {
      logger.log('Skipping .gitignore update - not a git repository')
      return
    }

    const gitignorePath = path.join(workspaceRoot, '.gitignore')
    const ignoreEntry = '.cursor/rules/'

    try {
      let gitignoreContent = ''
      let needsNewline = false

      // Read existing .gitignore file if it exists
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = await fs.promises.readFile(gitignorePath, 'utf8')

        // Check if the entry already exists
        const lines = gitignoreContent.split('\n')
        if (lines.some((line) => line.trim() === ignoreEntry)) {
          logger.log('Gitignore entry already exists', { ignoreEntry })
          return
        }

        // Check if file ends with newline
        needsNewline =
          gitignoreContent.length > 0 && !gitignoreContent.endsWith('\n')
      }

      // Append the ignore entry
      const prefix = needsNewline ? '\n' : gitignoreContent.length > 0 ? '' : ''
      const newContent = `${gitignoreContent}${prefix}${ignoreEntry}\n`

      await fs.promises.writeFile(gitignorePath, newContent, 'utf8')
      logger.log('Added entry to .gitignore', { ignoreEntry, gitignorePath })
    } catch (error) {
      logger.log('Error adding entry to .gitignore', {
        ignoreEntry,
        gitignorePath,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  private async removeFromGitignore(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!workspaceRoot) {
      return
    }

    // Only proceed if this is a git repository
    if (!(await this.isGitRepository())) {
      logger.log('Skipping .gitignore update - not a git repository')
      return
    }

    const gitignorePath = path.join(workspaceRoot, '.gitignore')
    const ignoreEntry = '.cursor/rules/'

    try {
      if (!fs.existsSync(gitignorePath)) {
        logger.log('No .gitignore file found to remove entry from')
        return
      }

      const gitignoreContent = await fs.promises.readFile(gitignorePath, 'utf8')
      const lines = gitignoreContent.split('\n')

      // Find and remove the specific entry
      const updatedLines = lines.filter((line) => line.trim() !== ignoreEntry)

      // Only write back if content changed
      if (updatedLines.length !== lines.length) {
        const newContent = updatedLines.join('\n')
        await fs.promises.writeFile(gitignorePath, newContent, 'utf8')
        logger.log('Removed entry from .gitignore', {
          ignoreEntry,
          gitignorePath
        })
      } else {
        logger.log('Gitignore entry was not found to remove', { ignoreEntry })
      }
    } catch (error) {
      logger.log('Error removing entry from .gitignore', {
        ignoreEntry,
        gitignorePath,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
}

export const registryManager = new RegistryManager()
