import type * as vscode from 'vscode'
import * as path from 'node:path'
import { logger } from '../common/logger'
import type { AttachmentType } from '../common/types'
import { determineAttachmentType } from '../common/types'

export class RuleDocument {
  public readonly attachmentType: AttachmentType
  public readonly globs: string
  public readonly description: string
  public readonly notes: string
  public readonly alwaysApply: boolean
  public readonly content: string
  public readonly frontmatter: Record<string, unknown>

  constructor(document: vscode.TextDocument, filePath?: string) {
    const text = document.getText()
    const parsed = this.parseFileContent(text)

    // Store all frontmatter for preservation
    this.frontmatter = parsed.frontmatter

    // Determine attachment type from frontmatter
    this.attachmentType = determineAttachmentType(parsed.frontmatter)

    // Extract specific fields, preserving original values
    this.globs = this.extractStringField(parsed.frontmatter, 'globs')
    this.description = this.extractStringField(
      parsed.frontmatter,
      'description'
    )
    this.notes = this.extractStringField(parsed.frontmatter, 'notes')

    // Handle alwaysApply with proper defaults based on attachment type
    this.alwaysApply = this.extractAlwaysApplyField(
      parsed.frontmatter,
      this.attachmentType
    )

    this.content = parsed.content
  }

  private extractStringField(
    frontmatter: Record<string, unknown>,
    field: string
  ): string {
    const value = frontmatter[field]
    if (typeof value === 'string') {
      return value.trim()
    }
    if (Array.isArray(value)) {
      // Convert array to comma-separated string (for globs, tags, etc.)
      return value.join(',')
    }
    return ''
  }

  private extractAlwaysApplyField(
    frontmatter: Record<string, unknown>,
    attachmentType: AttachmentType
  ): boolean {
    const value = frontmatter.alwaysApply

    // If explicitly set, use that value
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim()
      return lowerValue === 'true'
    }

    // If not set, derive from attachment type
    return attachmentType === 'always'
  }

  private extractBooleanField(
    frontmatter: Record<string, unknown>,
    field: string
  ): boolean {
    const value = frontmatter[field]
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim()
      return lowerValue === 'true'
    }
    return false
  }

  private parseFileContent(text: string): {
    frontmatter: Record<string, unknown>
    content: string
  } {
    // More strict frontmatter regex - must start at beginning of file
    const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/
    const match = text.match(frontMatterRegex)

    if (match) {
      const frontMatter = match[1]
      const content = match[2]

      // Parse frontmatter as key-value pairs, handling any order
      const frontMatterData = this.parseFrontMatterFields(frontMatter)

      // Debug logging
      logger.log('Frontmatter parsing debug:', {
        frontMatterLength: frontMatter.length,
        contentLength: content.length,
        contentPreview: content.substring(0, 200),
        frontMatterData,
        hasGlobs: !!frontMatterData.globs,
        hasDescription: !!frontMatterData.description,
        hasAlwaysApply: !!frontMatterData.alwaysApply
      })

      return {
        frontmatter: frontMatterData,
        content: content.trim()
      }
    } else {
      // No front matter found, treat entire content as markdown
      logger.log('No frontmatter found, using entire text as content:', {
        textLength: text.length,
        textPreview: text.substring(0, 200)
      })

      return {
        frontmatter: {},
        content: text.trim()
      }
    }
  }

  private parseFrontMatterFields(frontMatter: string): Record<string, unknown> {
    const data: Record<string, unknown> = {}

    // Split into lines and parse each field
    const lines = frontMatter.split(/\r?\n/)
    let currentKey = ''
    let currentValue: unknown = ''
    let inMultilineValue = false

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      // Check if this line starts a new key-value pair
      const keyValueMatch = trimmedLine.match(/^([^:]+):\s*(.*)$/)

      if (keyValueMatch && !inMultilineValue) {
        // Save previous key-value if exists
        if (currentKey) {
          data[currentKey] = this.parseValue(currentValue as string)
        }

        // Start new key-value
        currentKey = keyValueMatch[1].trim()
        currentValue = keyValueMatch[2].trim()

        // Check if this might be a multiline value (starts with |, >, or is empty)
        if (
          currentValue === '' ||
          (typeof currentValue === 'string' &&
            (currentValue.startsWith('|') || currentValue.startsWith('>')))
        ) {
          inMultilineValue = true
          currentValue =
            typeof currentValue === 'string'
              ? currentValue.replace(/^[|>]\s*/, '')
              : ''
        } else {
          inMultilineValue = false
        }
      } else if (inMultilineValue) {
        // Continue multiline value
        if (trimmedLine.match(/^[^:]+:/)) {
          // This looks like a new key, end multiline
          data[currentKey] = this.parseValue(currentValue as string)

          // Parse this line as new key-value
          const newKeyValueMatch = trimmedLine.match(/^([^:]+):\s*(.*)$/)
          if (newKeyValueMatch) {
            currentKey = newKeyValueMatch[1].trim()
            currentValue = newKeyValueMatch[2].trim()
            inMultilineValue = false
          }
        } else {
          // Add to current multiline value
          currentValue += (currentValue ? '\n' : '') + line
        }
      }
    }

    // Don't forget the last key-value pair
    if (currentKey) {
      data[currentKey] = this.parseValue(currentValue as string)
    }

    return data
  }

  private parseValue(value: string): unknown {
    const trimmedValue = value.trim().replace(/^["']|["']$/g, '')

    // Parse boolean values
    if (trimmedValue === 'true') return true
    if (trimmedValue === 'false') return false

    // Parse numbers
    if (/^\d+$/.test(trimmedValue)) {
      return Number.parseInt(trimmedValue, 10)
    }
    if (/^\d+\.\d+$/.test(trimmedValue)) {
      return Number.parseFloat(trimmedValue)
    }

    // Parse arrays (comma-separated values)
    if (trimmedValue.includes(',')) {
      return trimmedValue.split(',').map((item) => item.trim())
    }

    return trimmedValue
  }
}
