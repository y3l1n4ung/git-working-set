#!/bin/bash

# This script publishes the extension to the Open VSX Registry (VSCodium Marketplace).
# It requires the OVSX_TOKEN to be set in a .env file or as an environment variable.

if [ -f .env ]; then
  source .env
fi

if [ -z "$OVSX_TOKEN" ]; then
  echo "Error: OVSX_TOKEN not found. Please set it in a .env file or as an environment variable."
  exit 1
fi

ovsx publish -p "$OVSX_TOKEN"