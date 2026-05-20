#!/usr/bin/env bash
# Rebuild HTML files in docs/ for every COWEL 0.10.0 source file,
# but only when a corresponding HTML file already exists in docs/.
#
# Usage: scripts/rebuild-docs.sh
#   Run from the repository root.

set -e

failed=0

while IFS= read -r src; do
  name=$(basename "$src" .cow)
  dest="docs/${name}.html"
  if [ ! -f "$dest" ]; then
    echo "SKIP: $src (no pre-existing $dest)"
    continue
  fi
  cowel run "$src" "$dest"
  echo "BUILT: $src -> $dest"
done < <(grep -rl '\\: cowel 0\.10\.0' src/)

exit $failed
