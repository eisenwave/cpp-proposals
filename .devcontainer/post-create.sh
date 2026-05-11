#!/usr/bin/env bash

set -euo pipefail

version=0.9.1
vsix=/tmp/cowel-language-support-${version}.vsix
vsix_sha256=b214317dc401bf5c8643aa72e5a5bd14bbc90c2e4497dda1fe9f5f2e4b90130a

trap 'rm -f "$vsix"' EXIT

npm install -g "cowel@${version}"
curl -fsSL -o "$vsix" \
  "https://github.com/eisenwave/cowel/releases/download/v${version}/cowel-language-support-${version}.vsix"
echo "${vsix_sha256}  ${vsix}" | sha256sum --check || {
  echo "ERROR: SHA-256 checksum verification failed for ${vsix}" >&2
  exit 1
}

if command -v code > /dev/null 2>&1; then
  code --install-extension "$vsix" --force
else
  echo "WARNING: 'code' CLI not found; skipping COWEL VS Code extension install."
  echo "Install the extension manually from: $vsix"
fi
