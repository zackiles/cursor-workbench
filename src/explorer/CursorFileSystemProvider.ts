import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'
import { logger } from '../common/logger'
import { type TeamRegistry, registryManager } from '../common/registryManager'

export class CursorFileSystemProvider implements vscode.FileSystemProvider {
  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>()
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> =
    this._emitter.event

  stat(uri: vscode.Uri): vscode.FileStat {
    const realPath = this.resolveRealPath(uri)
    try {
      const stats = fs.statSync(realPath)
      return {
        type: stats.isDirectory()
          ? vscode.FileType.Directory
          : vscode.FileType.File,
        ctime: stats.ctimeMs,
        mtime: stats.mtimeMs,
        size: stats.size
      }
    } catch (error) {
      logger.log('Error statting file', {
        uri: uri.toString(),
        realPath,
        error
      })
      // Return a default file stat if the file doesn't exist
      return {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 0
      }
    }
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    const entries: [string, vscode.FileType][] = []
    const realPath = this.resolveRealPath(uri)

    try {
      if (fs.existsSync(realPath)) {
        for (const entry of fs.readdirSync(realPath)) {
          const fullPath = path.join(realPath, entry)
          const type = fs.statSync(fullPath).isDirectory()
            ? vscode.FileType.Directory
            : vscode.FileType.File
          entries.push([entry, type])
        }
      }
    } catch (error) {
      logger.log('Error reading directory', {
        uri: uri.toString(),
        realPath,
        error
      })
    }

    // Add virtual files from team registry
    const teamRegistry = registryManager.getTeamRegistry()
    if (teamRegistry) {
      const virtualPath = uri.fsPath
      const workspaceRoot =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
      const relativePath = path.relative(workspaceRoot, virtualPath)

      for (const file of teamRegistry.files) {
        const fileDir = path.dirname(file)
        if (
          fileDir === relativePath ||
          (relativePath === '' && fileDir === '.')
        ) {
          const fileName = path.basename(file)
          // Only add if not already in entries
          if (!entries.some(([name]) => name === fileName)) {
            entries.push([fileName, vscode.FileType.File])
          }
        }
      }
    }

    return entries
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const realPath = this.resolveRealPath(uri)
    try {
      return fs.readFileSync(realPath)
    } catch (error) {
      logger.log('Error reading file', { uri: uri.toString(), realPath, error })
      // Return empty content for virtual files that don't exist yet
      return new Uint8Array(
        Buffer.from(
          '---\nrule: New Rule\nglobs: **/*\n---\n\n# New Rule\n\nThis is a virtual rule file from the team registry.'
        )
      )
    }
  }

  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): void {
    const diskPath = this.getDiskWritePath(uri)
    try {
      fs.mkdirSync(path.dirname(diskPath), { recursive: true })
      fs.writeFileSync(diskPath, content)
      logger.log('File written', { uri: uri.toString(), diskPath })

      // Fire change event
      this._emitter.fire([
        {
          type: vscode.FileChangeType.Changed,
          uri
        }
      ])
    } catch (error) {
      logger.log('Error writing file', { uri: uri.toString(), diskPath, error })
      throw vscode.FileSystemError.NoPermissions(uri)
    }
  }

  delete(uri: vscode.Uri, options: { recursive: boolean }): void {
    const realPath = this.resolveRealPath(uri)
    try {
      if (options.recursive) {
        fs.rmSync(realPath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(realPath)
      }

      // Fire change event
      this._emitter.fire([
        {
          type: vscode.FileChangeType.Deleted,
          uri
        }
      ])
    } catch (error) {
      logger.log('Error deleting file', {
        uri: uri.toString(),
        realPath,
        error
      })
      throw vscode.FileSystemError.FileNotFound(uri)
    }
  }

  rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { overwrite: boolean }
  ): void {
    const oldPath = this.resolveRealPath(oldUri)
    const newPath = this.resolveRealPath(newUri)

    try {
      fs.renameSync(oldPath, newPath)

      // Fire change events
      this._emitter.fire([
        { type: vscode.FileChangeType.Deleted, uri: oldUri },
        { type: vscode.FileChangeType.Created, uri: newUri }
      ])
    } catch (error) {
      logger.log('Error renaming file', {
        oldUri: oldUri.toString(),
        newUri: newUri.toString(),
        error
      })
      throw vscode.FileSystemError.FileNotFound(oldUri)
    }
  }

  createDirectory(uri: vscode.Uri): void {
    const realPath = this.resolveRealPath(uri)
    try {
      fs.mkdirSync(realPath, { recursive: true })

      // Fire change event
      this._emitter.fire([
        {
          type: vscode.FileChangeType.Created,
          uri
        }
      ])
    } catch (error) {
      logger.log('Error creating directory', {
        uri: uri.toString(),
        realPath,
        error
      })
      throw vscode.FileSystemError.FileExists(uri)
    }
  }

  watch(
    uri: vscode.Uri,
    options: { recursive: boolean; excludes: string[] }
  ): vscode.Disposable {
    // For now, return a no-op disposable
    // In a full implementation, we'd watch the actual file system
    return new vscode.Disposable(() => {})
  }

  // Helper methods
  private resolveRealPath(uri: vscode.Uri): string {
    const virtualPath = uri.fsPath
    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''

    // First check if the file exists as a symlink in the project
    try {
      if (fs.existsSync(virtualPath)) {
        const stats = fs.lstatSync(virtualPath)
        if (stats.isSymbolicLink()) {
          // Follow the symlink to get the real path
          const realPath = fs.readlinkSync(virtualPath)
          logger.log('Resolved symlink to real path', {
            virtualPath,
            realPath
          })
          return realPath
        } else if (stats.isFile()) {
          // It's a real file in the project - use it directly
          logger.log('Using real project file', { virtualPath })
          return virtualPath
        }
      }
    } catch (error) {
      logger.log('Error checking file existence or symlink', {
        virtualPath,
        error: error instanceof Error ? error.message : String(error)
      })
    }

    // Check if this file exists in the team registry
    const teamRegistry = registryManager.getTeamRegistry()
    if (teamRegistry) {
      const relativePath = path.relative(workspaceRoot, virtualPath)
      // Normalize path separators for comparison
      const normalizedRelativePath = relativePath.replace(/\\/g, '/')

      if (teamRegistry.files.includes(normalizedRelativePath)) {
        const registryFilePath = path.join(
          teamRegistry.storageLocation,
          '.cursor',
          path.relative('.cursor', normalizedRelativePath)
        )
        logger.log('Resolving to team registry file', {
          virtualPath,
          relativePath: normalizedRelativePath,
          registryFilePath
        })
        return registryFilePath
      }
    }

    // Fallback to actual file path
    return virtualPath
  }

  private getDiskWritePath(uri: vscode.Uri): string {
    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
    return path.join(workspaceRoot, path.relative(workspaceRoot, uri.fsPath))
  }
}
