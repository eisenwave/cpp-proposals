#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const srcDir = path.join(repoRoot, "src");

function isTarget(filePath, text) {
  const base = path.basename(filePath);
  if (!base.endsWith(".cow") && !base.endsWith(".cowel")) return false;
  if (!text.startsWith("\\: cowel 0.6.0")) return false;
  if (base.includes("slides")) return false;
  if (base === "libslides.cow") return false;
  if (text.includes("libslides.cow")) return false;
  return true;
}

function quoteAsStr(raw) {
  const normalized = normalizeUrlEscapes(raw.replace(/\\,/g, ",").trim());
  const escaped = normalized.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
  return `\"${escaped}\"`;
}

function normalizeUrlEscapes(value) {
  if (!/^https?:\/\//i.test(value)) return value;
  return value
    .replace(/\\+N\{PERCENT SIGN\}/g, "%")
    .replace(/\\%/g, "%")
    .replace(/%[0-9a-fA-F]{2}/g, (m) => m.toUpperCase());
}

function splitArgs(argText) {
  const args = [];
  let cur = "";
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < argText.length; i += 1) {
    const ch = argText[i];
    if (escape) {
      cur += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      cur += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      cur += ch;
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "(") depthParen += 1;
      else if (ch === ")") depthParen -= 1;
      else if (ch === "{") depthBrace += 1;
      else if (ch === "}") depthBrace -= 1;
      else if (ch === "[") depthBracket += 1;
      else if (ch === "]") depthBracket -= 1;
      else if (ch === "," && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
        args.push(cur);
        cur = "";
        continue;
      }
    }
    cur += ch;
  }
  if (cur.length > 0) args.push(cur);
  return args;
}

function migrateCowelMacroArgs(text) {
  return text.replace(/\\cowel_macro\(([^)]*)\)/g, (_m, groupBody) => {
    const parts = splitArgs(groupBody).map((p) => p.trim()).filter((p) => p.length > 0);
    const migrated = parts.map((part) => {
      if (part === "...") return part;
      if (part.startsWith('"') && part.endsWith('"')) return part;
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) return quoteAsStr(part);
      return part;
    });
    return `\\cowel_macro(${migrated.join(", ")})`;
  });
}

function migrateRefCalls(text) {
  return text.replace(/\\ref\(([^()\n]*)\)/g, (_m, arg) => {
    const trimmed = arg.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      const inner = trimmed.slice(1, -1);
      return `\\ref(${quoteAsStr(inner)})`;
    }
    return `\\ref(${quoteAsStr(trimmed)})`;
  });
}

function migrateBibBlocks(text) {
  return text.replace(/\\bib\(([\s\S]*?)\)\\/g, (m, body) => {
    const lines = body.split("\n");
    const out = lines.map((line) => {
      const match = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*=\s*)(.*?)(\s*,\s*)?$/);
      if (!match) return line;

      const [, indent, rawKey, eq, rawValue, comma = ""] = match;
      const key = rawKey.replace(/-/g, "_");
      const value = rawValue.trim();

      if (value.startsWith('"') && value.endsWith('"')) {
        const inner = value.slice(1, -1);
        return `${indent}${key}${eq}${quoteAsStr(inner)}${comma}`;
      }

      // Keep directive-rich / expression values unquoted.
      if (/\\[A-Za-z_][A-Za-z0-9_]*(?:\{|\()/.test(value) || /\^\^\{|\?|:/.test(value)) {
        return `${indent}${key}${eq}${value}${comma}`;
      }

      return `${indent}${key}${eq}${quoteAsStr(value)}${comma}`;
    });
    return `\\bib(${out.join("\n")})\\`;
  });
}

function migrateWg21Head(text) {
  return text.replace(/\\wg21_head\(([\s\S]*?)\)\{/g, (_m, body) => {
    const migratedBody = body.replace(/(\n\s*title\s*=\s*)([^\n]+)\n/, (_l, prefix, value) => {
      const v = value.trim();
      if (v.startsWith("{")) return `${prefix}${v}\n`;
      return `${prefix}{${v}}\n`;
    });
    return `\\wg21_head(${migratedBody}){`;
  });
}

function migrateIncludes(text) {
  return text.replace(/\\cowel_include\{([^{}\n]+)\}/g, (_m, includePath) => {
    return `\\cowel_include(${quoteAsStr(includePath)})`;
  });
}

function normalizeQuotedUrls(text) {
  return text.replace(/"https?:\/\/[^"\n]*"/g, (q) => {
    const inner = q.slice(1, -1);
    return quoteAsStr(inner);
  });
}

const files = fs.readdirSync(srcDir)
  .map((f) => path.join(srcDir, f))
  .filter((p) => fs.statSync(p).isFile());

const changed = [];
for (const filePath of files) {
  const original = fs.readFileSync(filePath, "utf8");
  if (!isTarget(filePath, original)) continue;

  let text = original;
  text = text.replace(/^\\: cowel 0\.6\.0/m, "\\: cowel 0.9.1");
  text = migrateIncludes(text);
  text = migrateCowelMacroArgs(text);
  text = migrateRefCalls(text);
  text = migrateBibBlocks(text);
  text = migrateWg21Head(text);
  text = normalizeQuotedUrls(text);

  if (text !== original) {
    fs.writeFileSync(filePath, text, "utf8");
    changed.push(path.relative(repoRoot, filePath));
  }
}

for (const file of changed) {
  console.log(file);
}
console.error(`Migrated ${changed.length} files.`);
