import type * as vscode from 'vscode'

export class CustomFileDocument {
  public readonly rule: string
  public readonly globs: string
  public readonly content: string

  constructor(document: vscode.TextDocument) {
    const text = document.getText()
    const parsed = this.parseFileContent(text)
    this.rule = parsed.rule
    this.globs = parsed.globs
    this.content = parsed.content
  }

  private parseFileContent(text: string): {
    rule: string
    globs: string
    content: string
  } {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
    const match = text.match(frontMatterRegex)

    if (match) {
      const frontMatter = match[1]
      const content = match[2]

      // Parse front matter fields
      const ruleMatch = frontMatter.match(/rule:\s*(.+)/)
      const globsMatch = frontMatter.match(/globs:\s*(.+)/)

      return {
        rule: ruleMatch ? ruleMatch[1].trim() : '',
        globs: globsMatch ? globsMatch[1].trim() : '',
        content: content.trim()
      }
    } else {
      // No front matter found, treat entire content as markdown
      return {
        rule: '',
        globs: '',
        content: text
      }
    }
  }
}
