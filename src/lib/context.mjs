import fs from 'node:fs';
import path from 'node:path';
import { findFile } from './files.mjs';

/** Nearest ancestor (or the folder itself) that contains .git, a directory or a file. `limit` stops the climb. */
export function findRepoRoot(start, { limit } = {}) {
  let dir = path.resolve(start);
  const stop = limit ? path.resolve(limit) : null;
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (dir === stop || parent === dir) return null;
    dir = parent;
  }
}

/** Execution context shared by every check: the project folder and the repository root. */
export function makeContext(cwd) {
  const dir = path.resolve(cwd);
  return { cwd: dir, root: findRepoRoot(dir) ?? dir };
}

/** Directories from the project folder up to the repository root, nearest first. */
export function ancestors({ cwd, root = cwd }) {
  const start = path.resolve(cwd);
  const top = path.resolve(root);
  const rel = path.relative(top, start);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return [start];
  const dirs = [start];
  for (let dir = start; dir !== top; ) {
    dir = path.dirname(dir);
    dirs.push(dir);
  }
  return dirs;
}

/** Nearest file with one of `names`, looking in the project folder and then upwards to the repo root. */
export function findUp(ctx, names) {
  for (const dir of ancestors(ctx)) {
    const found = findFile(dir, names);
    if (found) return found;
  }
  return null;
}
