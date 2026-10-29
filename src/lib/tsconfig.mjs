import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { parseJsonc } from './jsonc.mjs';

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

/** <cwd>/tsconfig.json with its extends chain, or why it cannot be read: { entry, chain } | { problem }. */
export function loadRootTsconfig(cwd) {
  const entry = path.join(cwd, 'tsconfig.json');
  if (!fs.existsSync(entry)) return { problem: 'No existe tsconfig.json en la carpeta del proyecto' };
  try {
    return { entry, chain: loadTsconfigChain(entry) };
  } catch (err) {
    return { problem: `tsconfig.json inválido: ${err.message}` };
  }
}
