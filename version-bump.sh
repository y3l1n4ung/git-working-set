#!/bin/bash

# This script bumps the version of the extension.
# Usage: ./version-bump.sh <patch|minor|major>

if [ -z "$1" ]; then
  echo "Usage: $0 <patch|minor|major>"
  exit 1
fi

npm version "$1"