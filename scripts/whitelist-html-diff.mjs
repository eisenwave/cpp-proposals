#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";

const repoRoot = process.cwd();
const baseRef = process.argv[2] ?? "origin/main";

function run(cmd) {
  return cp.execSync(cmd, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 64,
  });
}

function getChangedHtmlFiles() {
  const out = run(`git --no-pager diff --name-only ${baseRef}...HEAD -- docs/*.html`);
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .sort();
}

function readBaseFile(relPath) {
  return run(`git show ${baseRef}:${relPath}`);
}

function existsInBase(relPath) {
  try {
    run(`git cat-file -e ${baseRef}:${relPath}`);
    return true;
  } catch {
    return false;
  }
}

function readHeadFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function removeFirstStyleBlock(html) {
  return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/i, "<style>__WHITELISTED_FIRST_STYLE__</style>");
}

function extractComparableRegion(html) {
  const headCloseMatch = html.match(/<\/head\s*>/i);
  if (headCloseMatch && headCloseMatch.index !== undefined) {
    return {
      text: html.slice(headCloseMatch.index + headCloseMatch[0].length),
      startIndex: headCloseMatch.index + headCloseMatch[0].length,
    };
  }

  // Fallback for malformed documents: try to start at <body> if </head> is missing.
  const bodyStart = html.search(/<body\b[^>]*>/i);
  if (bodyStart >= 0) {
    return {
      text: html.slice(bodyStart),
      startIndex: bodyStart,
    };
  }

  // Last resort: remove the first <head>...</head> block if present.
  const headOpen = html.search(/<head\b[^>]*>/i);
  if (headOpen < 0) return html;

  const afterOpen = html.slice(headOpen).search(/>/);
  if (afterOpen < 0) return html;

  const closeRel = html.slice(headOpen + afterOpen + 1).search(/<\/head\s*>/i);
  if (closeRel < 0) return html;

  const closeStart = headOpen + afterOpen + 1 + closeRel;
  const closeMatch = html.slice(closeStart).match(/^<\/head\s*>/i);
  const closeLen = closeMatch ? closeMatch[0].length : 7;
  return {
    text: html.slice(0, headOpen) + html.slice(closeStart + closeLen),
    startIndex: 0,
  };
}

function withIdentityMap(text, startIndex) {
  const map = new Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    map[i] = startIndex + i;
  }
  return { text, map };
}

function removeByRegexWithMap(obj, regex) {
  const source = obj.text;
  const outParts = [];
  const outMap = [];
  let last = 0;
  regex.lastIndex = 0;
  for (;;) {
    const m = regex.exec(source);
    if (!m) break;
    const s = m.index;
    const e = s + m[0].length;
    outParts.push(source.slice(last, s));
    for (let i = last; i < s; i += 1) outMap.push(obj.map[i]);
    last = e;
    if (!regex.global) break;
    if (m[0].length === 0) regex.lastIndex += 1;
  }
  outParts.push(source.slice(last));
  for (let i = last; i < source.length; i += 1) outMap.push(obj.map[i]);
  return { text: outParts.join(""), map: outMap };
}

function replaceFirstStyleWithMap(obj) {
  const re = /<style\b[^>]*>[\s\S]*?<\/style>/i;
  const m = re.exec(obj.text);
  if (!m) return obj;

  const placeholder = "<style>__WHITELISTED_FIRST_STYLE__</style>";
  const s = m.index;
  const e = s + m[0].length;
  const text = obj.text.slice(0, s) + placeholder + obj.text.slice(e);

  const map = [];
  for (let i = 0; i < s; i += 1) map.push(obj.map[i]);
  const anchor = obj.map[s] ?? obj.map[obj.map.length - 1] ?? 0;
  for (let i = 0; i < placeholder.length; i += 1) map.push(anchor);
  for (let i = e; i < obj.text.length; i += 1) map.push(obj.map[i]);

  return { text, map };
}

function normalizeInterTagWhitespaceWithMap(obj) {
  const source = obj.text;
  const re = />\s+</g;
  let last = 0;
  const outParts = [];
  const outMap = [];
  for (;;) {
    const m = re.exec(source);
    if (!m) break;
    const s = m.index;
    const e = s + m[0].length;

    outParts.push(source.slice(last, s));
    for (let i = last; i < s; i += 1) outMap.push(obj.map[i]);

    outParts.push("><");
    outMap.push(obj.map[s]);
    outMap.push(obj.map[e - 1]);

    last = e;
    if (m[0].length === 0) re.lastIndex += 1;
  }
  outParts.push(source.slice(last));
  for (let i = last; i < source.length; i += 1) outMap.push(obj.map[i]);
  return { text: outParts.join(""), map: outMap };
}

function normalizeUrlPercentEncodingWithMap(obj) {
  const source = obj.text;
  const urlRe = /https?:\/\/[^\s"'<>`]+/g;
  let last = 0;
  const outParts = [];
  const outMap = [];

  for (;;) {
    const m = urlRe.exec(source);
    if (!m) break;
    const s = m.index;
    const e = s + m[0].length;

    outParts.push(source.slice(last, s));
    for (let i = last; i < s; i += 1) outMap.push(obj.map[i]);

    let normalizedUrl = m[0]
      .replace(/\\N\{PERCENT SIGN\}/g, "%")
      .replace(/\\%/g, "%")
      .replace(/%[0-9a-fA-F]{2}/g, (hex) => {
        const code = Number.parseInt(hex.slice(1), 16);
        return String.fromCharCode(code);
      });

    const longLinkMatch = normalizedUrl.match(/long-link\s*=\s*(https?:\/\/\S+)/i);
    if (longLinkMatch) {
      normalizedUrl = longLinkMatch[1];
    } else {
      normalizedUrl = normalizedUrl.replace(/\s+.*$/, "");
    }

    normalizedUrl = normalizedUrl.trim();
    const wg21Short = normalizedUrl.match(/^https?:\/\/wg21\.link\/([A-Za-z0-9._-]+)/i);
    if (wg21Short) {
      normalizedUrl = `https://wg21.link/${wg21Short[1].toLowerCase()}`;
    } else {
      const openStdPaper = normalizedUrl.match(
        /^https?:\/\/(?:www\.)?open-std\.org\/jtc1\/sc22\/wg21\/docs\/papers\/\d{4}\/([np]\d+[a-z0-9]*)\.(?:html?|pdf)$/i,
      );
      if (openStdPaper) {
        normalizedUrl = `https://wg21.link/${openStdPaper[1].toLowerCase()}`;
      }
    }

    outParts.push(normalizedUrl);
    const anchor = obj.map[s] ?? 0;
    for (let i = 0; i < normalizedUrl.length; i += 1) outMap.push(anchor);

    last = e;
    if (m[0].length === 0) urlRe.lastIndex += 1;
  }

  outParts.push(source.slice(last));
  for (let i = last; i < source.length; i += 1) outMap.push(obj.map[i]);
  return { text: outParts.join(""), map: outMap };
}

function normalize(html) {
  const region = extractComparableRegion(html);
  let obj = withIdentityMap(region.text, region.startIndex);
  obj = replaceFirstStyleWithMap(obj);
  obj = removeByRegexWithMap(obj, /h-\[data-h\^=[^\]]+\]\s*\{[^{}]*\}\s*/g);
  obj = removeByRegexWithMap(obj, /<\/?h-(?:\s[^>]*)?>/g);
  obj = normalizeInterTagWhitespaceWithMap(obj);
  obj = normalizeUrlPercentEncodingWithMap(obj);
  obj = removeByRegexWithMap(obj, /\s+long-link\s*=\s*https?:\/\/[^\s<"']+/gi);
  return obj;
}

function firstDiffIndex(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : n;
}

function lineColAt(text, index) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text[i] === "\n") {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }
  return { line, col };
}

const changed = getChangedHtmlFiles();
if (changed.length === 0) {
  console.log("No changed docs/*.html files relative to " + baseRef + ".");
  process.exit(0);
}

const failures = [];
const passed = [];
const skipped = [];

for (const rel of changed) {
  if (!existsInBase(rel)) {
    skipped.push(rel);
    continue;
  }

  const base = readBaseFile(rel);
  const head = readHeadFile(rel);

  if (base === head) {
    passed.push({ rel, mode: "identical" });
    continue;
  }

  const normBase = normalize(base);
  const normHead = normalize(head);

  if (normBase.text === normHead.text) {
    passed.push({ rel, mode: "whitelisted" });
    continue;
  }

  const idx = firstDiffIndex(normBase.text, normHead.text);
  const posNormBase = lineColAt(normBase.text, idx);
  const posNormHead = lineColAt(normHead.text, idx);
  const srcIdxBase = idx >= 0 && idx < normBase.map.length ? normBase.map[idx] : base.length - 1;
  const srcIdxHead = idx >= 0 && idx < normHead.map.length ? normHead.map[idx] : head.length - 1;
  const posSrcBase = lineColAt(base, srcIdxBase);
  const posSrcHead = lineColAt(head, srcIdxHead);

  const baseHeadClose = (base.match(/<\/head\s*>/i)?.index ?? -1);
  const headHeadClose = (head.match(/<\/head\s*>/i)?.index ?? -1);
  const baseInHead = baseHeadClose >= 0 && srcIdxBase <= baseHeadClose;
  const headInHead = headHeadClose >= 0 && srcIdxHead <= headHeadClose;

  failures.push({
    rel,
    idx,
    posNormBase,
    posNormHead,
    posSrcBase,
    posSrcHead,
    baseInHead,
    headInHead,
  });
}

for (const p of passed) {
  console.log(`PASS ${p.mode.padEnd(10)} ${p.rel}`);
}

for (const rel of skipped) {
  console.log(`SKIP            ${rel} (missing in ${baseRef})`);
}

if (failures.length > 0) {
  console.error("\nFound non-whitelisted HTML differences:");
  for (const f of failures) {
    console.error(`FAIL            ${f.rel}`);
    console.error(`  first diff mapped to source at base L${f.posSrcBase.line}:C${f.posSrcBase.col}, head L${f.posSrcHead.line}:C${f.posSrcHead.col}`);
    if (f.baseInHead || f.headInHead) {
      console.error("  INTERNAL ERROR: reported diff maps inside <head>, which should be impossible.");
    }
  }
  process.exit(1);
}

console.log(`\nAll ${passed.length} comparable changed HTML files are whitelisted relative to ${baseRef}.`);
