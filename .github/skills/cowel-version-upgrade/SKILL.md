---
name: cowel-version-upgrade
description: 'Upgrade COWEL paper sources and repo tooling to a newer COWEL release. Use when bumping : cowel version lines in src/*.cow, updating scripts and GitHub workflows, rebuilding docs, and verifying bitwise-identical outputs.'
argument-hint: '<old-version> <new-version> [--dry-run]'
user-invocable: true
---

# COWEL Version Upgrade

Upgrade this repository from one COWEL version to another in a repeatable, low-risk way.

## When To Use
- Bumping COWEL from one release to another (for example 0.10.0 to 0.10.1)
- Updating paper headers in `src/*.cow`
- Updating workflow and script pins for COWEL
- Rebuilding docs and checking for bitwise-identical output

## Inputs
- Old version (currently in sources), for example `0.10.0`
- New version (target), for example `0.10.1`
- Optional `--dry-run` to preview changed files

## Procedure
1. Run version replacement:
   - [upgrade-cowel-version.sh](./scripts/upgrade-cowel-version.sh)
2. Rebuild and verify:
   - [rebuild-and-verify.sh](./scripts/rebuild-and-verify.sh)
3. If verification fails, patch only impactful nested inline-code rendering sites (for example switching selected `tcode` to `ocode`) and rerun verification.

## Decision Points
- If only source headers changed and verify passes: no content-level patching required.
- If verify fails with nested-highlighting artifacts in generated HTML: update only the specific nested inline-code call sites that affect output.
- If a file should intentionally remain on an older COWEL syntax version: do not force-upgrade it; keep versioned legacy files unchanged unless explicitly requested.

## Files Typically Touched
- `src/*.cow`: version header lines like `\: cowel X.Y.Z`
- `scripts/rebuild-docs.sh`: version comments/grep patterns
- `.github/workflows/*.yml`: pinned `cowel@X.Y.Z`
- `README.md`: documented version pin(s)
- `.devcontainer/post-create.sh`: devcontainer COWEL version pin
- Optional repo-specific setup docs (for example `.github/copilot-instructions.md`)

## Completion Criteria
- No remaining old-version references:
  - `rg -n "<old>|cowel@<old>|\\: cowel <old>"`
- Rebuild succeeds for targeted docs.
- Verification passes with no mismatches.

## Notes
- Keep changes minimal and targeted.
- Prefer surgical source edits over broad style changes when restoring bitwise output compatibility.
