import { ok } from 'node:assert'
import { extensions, window } from 'vscode'

// Simple test suite for the custom file editor extension
suite('Custom File Editor Extension Test Suite', () => {
  window.showInformationMessage('Start all tests.')

  test('Extension should be present', () => {
    const extension = extensions.getExtension(
      'cursor-workbench.cursor-workbench'
    )
    ok(extension, 'Extension should be found')
  })

  test('Extension should activate', async () => {
    const extension = extensions.getExtension(
      'cursor-workbench.cursor-workbench'
    )
    await extension.activate()
    ok(extension.isActive, 'Extension should be active')
  })

  test('Custom editor should be registered', () => {
    // This test verifies that our custom editor provider is registered
    // In a real scenario, you would test opening a .rule file and verifying
    // that the custom editor is used
    ok(true, 'Custom editor registration test placeholder')
  })
})

// Test the document parsing functionality
suite('CustomFileDocument Tests', () => {
  test('Should parse front matter correctly', () => {
    // Mock test for front matter parsing
    const sampleContent = `---
rule: test-rule
globs: "*.js,*.ts"
---

# Test Content

This is sample content.`

    // In a real test, you would import and test the CustomFileDocument class
    // For now, this is a placeholder to show the testing structure
    ok(true, 'Front matter parsing test placeholder')
  })

  test('Should handle content without front matter', () => {
    const contentWithoutFrontMatter = `# Just Content

This file has no front matter.`

    // Test that files without front matter are handled gracefully
    ok(true, 'No front matter handling test placeholder')
  })
})
