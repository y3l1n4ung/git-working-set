#!/bin/bash

# Ensure we are in the project root
cd "$(dirname "$0")"

# Compile the project
echo "Compiling..."
npm run compile

if [ $? -ne 0 ]; then
    echo "Compilation failed. Please check errors."
    exit 1
fi

# Check if 'code' command exists
if ! command -v code &> /dev/null; then
    echo "Error: 'code' command not found in your PATH."
    echo "Please open VS Code, press Cmd+Shift+P, and run 'Shell Command: Install 'code' command in PATH'."
    exit 1
fi

# Launch VS Code in extension development mode
echo "Launching Extension Development Host..."
code --extensionDevelopmentPath="$PWD" "$PWD"
