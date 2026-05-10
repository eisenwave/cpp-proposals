#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const srcDir = path.join(repoRoot, "src");

function isTarget(filePath, text) {
  const base = path.basename(filePath);
  if (!base.endsWith(".cow") && !base.endsWith(".cowel")) return false;
  if (!text.startsWith("\\: cowel 0.9.1")) return false;
  if (base.includes("slides")) return false;
  if (base === "libslides.cow") return false;
  if (base.endsWith("-9.cow")) return false;
  return true;
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

function findTopLevelEquals(arg) {
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < arg.length; i += 1) {
    const ch = arg[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "(") depthParen += 1;
    else if (ch === ")") depthParen -= 1;
    else if (ch === "{") depthBrace += 1;
    else if (ch === "}") depthBrace -= 1;
    else if (ch === "[") depthBracket += 1;
    else if (ch === "]") depthBracket -= 1;
    else if (ch === "=" && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
      return i;
    }
  }

  return -1;
}

function quoteAsStr(raw) {
  const normalized = raw.replace(/\\,/g, ",").trim();
  const escaped = normalized.replace(/\"/g, "\\\"");
  return `\"${escaped}\"`;
}

function normalizeQuoted(v) {
  if (!(v.startsWith('"') && v.endsWith('"'))) return v;
  const inner = v.slice(1, -1)
    .replace(/\\(?=[A-Za-z_]+\()/g, "\\")
    .replace(/\\(?=[A-Za-z_]+\{)/g, "\\");
  return `\"${inner}\"`;
}

function looksNumeric(v) {
  return /^[-+]?(?:\d+|\d*\.\d+)(?:[eE][-+]?\d+)?$/.test(v)
    || /^0[xX][0-9a-fA-F]+$/.test(v)
    || /^0[bB][01]+$/.test(v)
    || /^0[oO][0-7]+$/.test(v);
}

function normalizeValue(value) {
  let v = value.trim();
  if (v.length === 0) return v;

  if (v === "...") return v;
  if (v.startsWith('"') && v.endsWith('"')) return normalizeQuoted(v);
  if (v.startsWith("{") || v.startsWith("[") || v.startsWith("(")) return v;
  if (v === "true" || v === "false" || v === "null") return v;
  if (looksNumeric(v)) return v;
  if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(v)) return v;

  return quoteAsStr(v);
}

function migrateGroup(name, body) {
  const args = splitArgs(body).map((a) => a.trim()).filter((a) => a.length > 0);
  const migrated = args.map((arg) => {
    const eq = findTopLevelEquals(arg);
    if (eq >= 0) {
      const rawKey = arg.slice(0, eq).trim();
      const rawVal = arg.slice(eq + 1).trim();
      const key = rawKey.replace(/-/g, "_");
      return `${key}=${normalizeValue(rawVal)}`;
    }
    return normalizeValue(arg);
  });
  return `\\${name}(${migrated.join(", ")})`;
}

function migrateDirectiveGroups(text) {
  let i = 0;
  let out = "";

  while (i < text.length) {
    if (text[i] !== "\\") {
      out += text[i];
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j += 1;

    if (j === i + 1 || text[j] !== "(") {
      out += text[i];
      i += 1;
      continue;
    }

    const name = text.slice(i + 1, j);
    const groupStart = j;
    let k = groupStart + 1;
    let depth = 1;
    let inString = false;
    let escape = false;

    while (k < text.length && depth > 0) {
      const ch = text[k];
      if (escape) {
        escape = false;
        k += 1;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        k += 1;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        k += 1;
        continue;
      }
      if (!inString) {
        if (ch === "(") depth += 1;
        else if (ch === ")") depth -= 1;
      }
      k += 1;
    }

    if (depth !== 0) {
      out += text[i];
      i += 1;
      continue;
    }

    const body = text.slice(groupStart + 1, k - 1);
    out += migrateGroup(name, body);
    i = k;
  }

  return out;
}

const files = fs.readdirSync(srcDir)
  .map((f) => path.join(srcDir, f))
  .filter((p) => fs.statSync(p).isFile());

const changed = [];
for (const filePath of files) {
  const original = fs.readFileSync(filePath, "utf8");
  if (!isTarget(filePath, original)) continue;

  let text = original;
  text = migrateDirectiveGroups(text);

  if (text !== original) {
    fs.writeFileSync(filePath, text, "utf8");
    changed.push(path.relative(repoRoot, filePath));
  }
}

for (const file of changed) console.log(file);
console.error(`Updated ${changed.length} files.`);
