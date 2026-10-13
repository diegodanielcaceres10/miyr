import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Dependency-free JSONC parser (// and block comments, trailing commas, BOM).
 * It does not rely on the TypeScript API, so it works with any compiler version.
 */
export function parseJsonc(text) {
  let out = '';
  let inString = false;
  const src = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];

    if (inString) {
      out += c;
      if (c === '\\') out += src[++i] ?? '';
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === '/' && next === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && next === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i++; continue; }
    // Comments are already gone, so a trailing comma is the last non-space char in `out`.
    if (c === '}' || c === ']') out = out.replace(/,\s*$/, '');
    out += c;
  }
  return JSON.parse(out);
}

function resolveExtends(spec, fromDir) {
  if (spec.startsWith('.') || path.isAbsolute(spec)) {
    const p = path.resolve(fromDir, spec);
    return p.endsWith('.json') ? p : `${p}.json`;
  }
  const req = createRequire(path.join(fromDir, 'noop.js'));
  const candidates = spec.endsWith('.json') ? [spec] : [spec, `${spec}.json`, `${spec}/tsconfig.json`];
  for (const candidate of candidates) {
    try {
      return req.resolve(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

/** Returns the config chain ordered from base to leaf (the leaf wins on conflicts). */
export function loadTsconfigChain(entryFile) {
  const chain = [];
  const seen = new Set();

  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const config = parseJsonc(fs.readFileSync(file, 'utf8'));
    for (const spec of [].concat(config.extends ?? [])) {
      const resolved = resolveExtends(spec, path.dirname(file));
      if (resolved && fs.existsSync(resolved)) visit(resolved);
    }
    chain.push({ file, config });
  };

  visit(entryFile);
  return chain;
}

/** Effective value of every option, plus the file that defines it. */
export function effectiveOptions(chain, section = 'compilerOptions') {
  const result = {};
  for (const { file, config } of chain) {
    for (const [key, value] of Object.entries(config[section] ?? {})) {
      result[key] = { value, file };
    }
  }
  return result;
}
