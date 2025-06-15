import * as vscode from 'vscode'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import * as crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { logger } from './logger'

export interface TeamRegistry {
  url: string
  storageLocation: string
  files: string[]
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

    const registryPath = path.join(this.teamRegistry.storageLocation, '.cursor')
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

      // Clone repository to temporary location
      const tempDir = await this.cloneRepository(gitUrl)

      try {
        // Copy .cursor folder to storage
        const cursorSrcPath = path.join(tempDir, '.cursor')
        const cursorDestPath = path.join(storageLocation, '.cursor')

        if (fs.existsSync(cursorSrcPath)) {
          await this.copyDirectory(cursorSrcPath, cursorDestPath)
          logger.log('Copied .cursor folder to storage', { cursorDestPath })
        } else {
          throw new Error('No .cursor folder found in repository')
        }

        // Get list of files in the registry
        const files = await this.getRegistryFiles(cursorDestPath)

        // Create symlinks to project
        await this.createSymlinks(cursorDestPath, files)

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
      } finally {
        // Clean up temporary directory
        await this.removeDirectory(tempDir)
      }
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

  private async cloneRepository(gitUrl: string): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `cursor-registry-${Date.now()}`)

    return new Promise((resolve, reject) => {
      const git = spawn('git', [
        'clone',
        '--depth',
        '1',
        '--branch',
        'main',
        gitUrl,
        tempDir
      ])

      git.on('close', (code: number) => {
        if (code === 0) {
          logger.log('Repository cloned successfully', { gitUrl, tempDir })
          resolve(tempDir)
        } else {
          reject(new Error(`Git clone failed with code ${code}`))
        }
      })

      git.on('error', (error: Error) => {
        reject(new Error(`Git clone failed: ${error.message}`))
      })
    })
  }

  private async copyDirectory(srcDir: string, destDir: string): Promise<void> {
    await fs.promises.mkdir(destDir, { recursive: true })

    const entries = await fs.promises.readdir(srcDir, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name)
      const destPath = path.join(destDir, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await fs.promises.copyFile(srcPath, destPath)
      }
    }
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
    const ruleExtensions = ['.rule', '.md', '.mdc', '.yml', '.yaml', '.json']
    const extension = path.extname(fileName).toLowerCase()
    return ruleExtensions.includes(extension)
  }
}

export const registryManager = new RegistryManager()
