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

# Check if tag already exists
if git tag -l | grep -q "^v$VERSION$"; then
  echo "⚠️  Warning: Tag v$VERSION already exists"
  echo "Would you like to delete and recreate it? (y/N)"
  read -r response
  if [[ "$response" =~ ^[Yy]$ ]]; then
    git tag -d "v$VERSION"
    git push origin ":refs/tags/v$VERSION" 2>/dev/null || true
  else
    echo "❌ Aborted: Tag already exists"
    exit 1
  fi
fi

# Create annotated tag
git tag -a "v$VERSION" -m "Release v$VERSION"

# Push tag to origin
git push origin "v$VERSION"

echo "✅ Tag v$VERSION created and pushed successfully"
echo ""
echo "View release at: https://github.com/rhysllwydlewis/eventflow/releases/tag/v$VERSION"
