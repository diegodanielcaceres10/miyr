import fs from 'node:fs';
import path from 'node:path';
import { ancestors, baseFor } from './context.mjs';
import { readText } from './files.mjs';

function globSource(body) {
  return body
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '.*');
}

function parseRules(text) {
  const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const negated = line.startsWith('!');
    let body = (negated ? line.slice(1) : line).replace(/\/+$/, '');
    if (!body) continue;
    const deep = body.startsWith('**/');
    if (deep) body = body.slice(3);
    // Like git: a slash at the start or in the middle anchors the pattern to the .gitignore folder.
    const anchored = !deep && body.includes('/');
    const byPath = anchored || (deep && body.includes('/'));
    const source = globSource(body.replace(/^\//, ''));
    rules.push({ negated, byPath, regex: new RegExp(deep && byPath ? `^(?:.*/)?${source}$` : `^${source}$`) });
  }
  return rules;
}

/**
 * Result of one .gitignore for a path relative to its folder (posix separators):
 * true = ignored, false = re-included by a negation, null = no rule matched.
 * Basic glob support; a path below an ignored directory is always ignored.
 */
export function ignoreState(text, relPath) {
  const rules = parseRules(text);
  const segments = relPath.split('/').filter(Boolean);
  let state = null;
  for (let i = 1; i <= segments.length; i++) {
    const full = segments.slice(0, i).join('/');
    const name = segments[i - 1];
    state = null;
    for (const rule of rules) {
      if (rule.regex.test(rule.byPath ? full : name)) state = !rule.negated;
    }
    if (state === true && i < segments.length) return true;
  }
  return state;
}

export const isIgnored = (text, relPath) => ignoreState(text, relPath) === true;

/** Existing .gitignore files from the folder declared for them (the project itself by default) down to the project. */
export function gitignoreFiles(ctx) {
  return ancestors(ctx.cwd, baseFor(ctx, 'gitignore'))
    .reverse()
    .map((dir) => path.join(dir, '.gitignore'))
    .filter((file) => fs.existsSync(file));
}

/** Whether `name`, a file or folder inside the project, is ignored by the .gitignore chain (deeper files win). */
export function isIgnoredInRepo(ctx, name) {
  let state = null;
  for (const file of gitignoreFiles(ctx)) {
    const rel = path.relative(path.dirname(file), path.join(ctx.cwd, name)).split(path.sep).join('/');
    const result = ignoreState(readText(file), rel);
    if (result !== null) state = result;
  }
  return state === true;
}
