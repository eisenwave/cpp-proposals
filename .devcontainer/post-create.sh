#!/usr/bin/env bash

set -euo pipefail

vsix=/tmp/cowel-language-support-0.9.1.vsix

npm install -g cowel@0.9.1
curl -fsSL -o "$vsix" \
  https://github.com/eisenwave/cowel/releases/download/v0.9.1/cowel-language-support-0.9.1.vsix
code --install-extension "$vsix" --force
rm -f "$vsix"
