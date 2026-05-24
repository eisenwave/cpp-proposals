#!/usr/bin/env bash
set -euo pipefail

# Rebuild docs for current versioned sources, then verify generated output.
# Usage:
#   ./scripts/rebuild-and-verify.sh

repo_root="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$repo_root"

if [[ ! -x scripts/rebuild-docs.sh ]]; then
  echo "Missing executable scripts/rebuild-docs.sh" >&2
  exit 1
fi

if [[ ! -x scripts/verify-docs.sh ]]; then
  echo "Missing executable scripts/verify-docs.sh" >&2
  exit 1
fi

./scripts/rebuild-docs.sh
./scripts/verify-docs.sh

echo "Rebuild + verify completed successfully."
