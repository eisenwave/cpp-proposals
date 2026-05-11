# GitHub Copilot Instructions

This repository contains C++ standards proposals,
presentations,
and other documents related to the C++ standardization process.
Most sources are written in COWEL (Compact Web Language).
Some older sources use Bikeshed,
but this format is not used for any new documents.

## Repository Structure

- `src/` - Source files in COWEL and Bikeshed formats
- `docs/` - Generated HTML outputs from source files
- `scripts/` - Utility scripts for rebuilding and verifying generated docs
- `slides/` - Presentation materials (no longer actively used)
- `README.md` - Repository overview

## Source File Formats

### COWEL Sources

Most paper sources are written in **COWEL**.
It is a specialized language designed for C++ proposal documentation.

- **File extensions**: `.cow` or `.cowel`
- **Default version**: COWEL 0.9.1
- **Version specification**: All files include a version comment at the top
  (e.g., `\: cowel 0.9.1`)
- **Build command**: `cowel run input.cow output.html`
- **Installation**:
  - Latest: `npm i -g cowel`
  - Specific version: `npm i -g cowel@0.9.1`

**Resources**:

- [COWEL GitHub repository](https://github.com/eisenwave/cowel/)
- [COWEL Agent-friendly language reference](https://raw.githubusercontent.com/eisenwave/cowel/refs/heads/main/.github/lang-summary.md)
- [COWEL full language reference](https://cowel.org/)
  (very detailed but not needed by agents in most cases)

### Bikeshed Sources

Some sources use **Bikeshed**.
It is the W3C specification toolchain.

- **File extension**: `.bs`
- **Build command**: `bikeshed spec input.bs output.html`

## Building Documents

### Building a COWEL Document
```sh
cowel run src/example.cow docs/example.html
```

### Building a Bikeshed Document
```sh
bikeshed spec src/example.bs docs/example.html
```

## Important Notes

- When working with COWEL documents,
  always load the latest agent-friendly COWEL reference into context.
- Agent-friendly COWEL reference refers to the latest version,
  not to 0.6.0.
  Syntax was changed substantially since 0.6.0.
- When examining or modifying paper sources,
  check for version comments at the top of `.cow`/`.cowel` files
- Check the current COWEL version with `cowel --version`
  before building COWEL documents
- Generated HTML files in `docs/` should not be edited directly
  Regenerate from sources instead
- Both COWEL and Bikeshed toolchains should be installed for development
- All markup sources use [semantic line breaks](https://sembr.org/)
  for better readability and version control
  (Some older sources may not follow this convention consistently)
