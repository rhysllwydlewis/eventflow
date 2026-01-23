#!/bin/bash
# Create and push a release tag based on package.json version

set -e

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

if [ -z "$VERSION" ]; then
  echo "❌ Error: Could not read version from package.json"
  exit 1
fi

echo "Creating tag v$VERSION..."

# Create annotated tag
git tag -a "v$VERSION" -m "Release v$VERSION"

# Push tag to origin
git push origin "v$VERSION"

echo "✅ Tag v$VERSION created and pushed successfully"
echo ""
echo "View release at: https://github.com/rhysllwydlewis/eventflow/releases/tag/v$VERSION"
