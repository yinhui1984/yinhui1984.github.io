#!/usr/bin/env sh

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <new-article-name>" >&2
  exit 1
fi

# Check if hugo is available
if ! command -v hugo > /dev/null 2>&1; then
  echo "Error: hugo command not found. Please install Hugo first." >&2
  exit 1
fi

# Combine all args into one string with '-' separator
OLD_IFS="${IFS}"
IFS='-'
ARTICLE_NAME="$*"
IFS="${OLD_IFS}"

# Add .md extension
ARTICLE_NAME="${ARTICLE_NAME}.md"

echo "Creating new article: $ARTICLE_NAME"

# Create the article
hugo new posts/"$ARTICLE_NAME"

# Verify file was created
FILE_PATH="./content/posts/${ARTICLE_NAME}"
if [ ! -f "${FILE_PATH}" ]; then
  echo "Error: File was not created: ${FILE_PATH}" >&2
  exit 1
fi

# Open the file (macOS only, silently fail on other systems)
if command -v open > /dev/null 2>&1; then
  open "${FILE_PATH}" > /dev/null 2>&1 || true
fi
