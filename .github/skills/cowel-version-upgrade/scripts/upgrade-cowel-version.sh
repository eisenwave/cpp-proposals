#!/usr/bin/env bash
set -euo pipefail

# Bulk-upgrade repo references from one COWEL version to another.
# Usage:
#   ./scripts/upgrade-cowel-version.sh <old-version> <new-version> [--dry-run]

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: $0 <old-version> <new-version> [--dry-run]" >&2
  exit 2
fi

old="$1"
new="$2"
dry_run="${3:-}"

repo_root="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$repo_root"

if [[ "$old" == "$new" ]]; then
  echo "Old and new versions are identical: $old" >&2
  exit 2
fi

# Update only files that are expected to contain version pins.
mapfile -t files < <(
  {
    find src -type f -name '*.cow' -print
    printf '%s\n' README.md scripts/rebuild-docs.sh
    find .github/workflows -type f \( -name '*.yml' -o -name '*.yaml' \) -print
    printf '%s\n' .devcontainer/post-create.sh
    [[ -f .github/copilot-instructions.md ]] && printf '%s\n' .github/copilot-instructions.md
  } | sort -u
)

changed=0
for f in "${files[@]}"; do
  [[ -f "$f" ]] || continue

  if [[ -n "$dry_run" ]]; then
    if rg -q "${old}|cowel@${old}|\\\\: cowel ${old}" "$f"; then
      echo "WOULD UPDATE: $f"
      changed=1
    fi
    continue
  fi

  if rg -q "${old}|cowel@${old}|\\\\: cowel ${old}" "$f"; then
    sed -i "s/${old//./\\.}/${new}/g" "$f"
    echo "UPDATED: $f"
    changed=1
  fi
done

if [[ -n "$dry_run" ]]; then
  if [[ $changed -eq 0 ]]; then
    echo "No files would be updated for ${old} -> ${new}."
  fi
  exit 0
fi

if [[ $changed -eq 0 ]]; then
  echo "No files updated for ${old} -> ${new}."
else
  echo "Version upgrade applied: ${old} -> ${new}."
fi
