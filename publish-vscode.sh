#!/bin/bash

# This script publishes the extension to the VS Code Marketplace.
# It requires the VSCE_TOKEN to be set in a .env file or as an environment variable.

if [ -f .env ]; then
  source .env
fi

if [ -z "$VSCE_TOKEN" ]; then
  echo "Error: VSCE_TOKEN not found. Please set it in a .env file or as an environment variable."
  exit 1
fi

vsce publish -p "$VSCE_TOKEN"