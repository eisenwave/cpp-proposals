#!/usr/bin/env bash
# Verify that the HTML files in docs/ are bitwise identical to the output
# produced by the currently installed cowel for every source file whose
# version comment matches the installed version.
# Also rejects trailing whitespace and literal tab characters in all .cow files.
# Also rejects CRLF line terminators and missing final newlines in all src/ files.
#
# Usage: scripts/verify-docs.sh
#   Run from the repository root.

set -e

version=$(cowel --version)
failed=0

# Check all src/ files for CRLF line terminators and missing final newline.
while IFS= read -r src; do
  if grep -Pq $'\r' "$src" 2>/dev/null; then
    echo "CRLF: $src contains CRLF line terminators"
    failed=1
  fi
  if [ -s "$src" ]; then
    last=$(tail -c 1 "$src" | od -An -tx1 | tr -d ' \n')
    if [ "$last" != "0a" ] && [ "$last" != "" ]; then
      echo "NO_FINAL_NL: $src does not end with a newline"
      failed=1
    fi
  fi
done < <(find src/ -type f)

# Check all .cow sources for trailing whitespace and tab characters.
while IFS= read -r src; do
  if grep -Pq '\t' "$src"; then
    echo "TABS: $src contains literal tab characters"
    failed=1
  fi
  if grep -Pq ' +$' "$src"; then
    echo "TRAILING_WS: $src contains trailing whitespace"
    failed=1
  fi
done < <(find src/ -name '*.cow')

while IFS= read -r src; do
  name=$(basename "$src" .cow)
  expected="docs/${name}.html"
  if [ ! -f "$expected" ]; then
    echo "SKIP: $src (no corresponding $expected in docs/)"
    continue
  fi
  actual=$(mktemp --suffix=.html)
  cowel run "$src" "$actual"
  if ! cmp -s "$expected" "$actual"; then
    echo "MISMATCH: $src does not match $expected"
    diff "$expected" "$actual" || true
    failed=1
  else
    echo "OK: $src matches $expected"
  fi
done < <(grep -rl "\\\\: cowel ${version}" src/)

exit $failed
