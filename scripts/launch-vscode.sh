#!/bin/bash
# This script launches Visual Studio Code with the provided arguments.
# This is a workaround to ensure the extension host runs in VS Code, not Cursor.

# Absolute path to the VS Code executable on macOS.
# If your VS Code is installed elsewhere, you will need to update this path.
VSCODE_PATH="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"

if [ -f "$VSCODE_PATH" ]; then
  "$VSCODE_PATH" "$@"
  echo "VS Code executable found at $VSCODE_PATH. Launching VS Code with arguments: $@"
else
  # Fallback to 'code' command if the absolute path doesn't exist.
  # Ensure 'code' in your PATH points to the real VS Code, not Cursor.
  echo "VS Code executable not found at $VSCODE_PATH. Falling back to 'code' command." >&2
  code "$@"
fi
