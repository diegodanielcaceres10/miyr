import path from 'node:path';
import { findFile } from './files.mjs';

/** Kinds of file whose folder can be declared in the manifest (`shared` and per-project `locations`). */
export const KINDS = ['ci', 'license', 'readme', 'editorconfig', 'gitignore', 'node-version'];

/**
 * How far up a kind of file may be searched: the folder declared for it in the manifest,
 * or the project folder itself, which is the default (nothing outside the project is read).
 */
export const baseFor = (ctx, kind) => path.resolve(ctx.locations?.[kind] ?? ctx.cwd);

/** Directories from the project folder up to `base`, nearest first. A base that is not above the project is ignored. */
export function ancestors(cwd, base = cwd) {
  const start = path.resolve(cwd);
  const top = path.resolve(base);
  const rel = path.relative(top, start);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return [start];
  const dirs = [start];
  for (let dir = start; dir !== top; ) {
    dir = path.dirname(dir);
    dirs.push(dir);
  }
  return dirs;
}

/** Nearest file with one of `names`, from the project folder up to the base of that kind and never past it. */
export function findUp(ctx, kind, names) {
  for (const dir of ancestors(ctx.cwd, baseFor(ctx, kind))) {
    const found = findFile(dir, names);
    if (found) return found;
  }
  return null;
}

/** Where a search for this kind looked, to put in a message. */
export function whereSearched(ctx, kind) {
  const base = baseFor(ctx, kind);
  if (base === path.resolve(ctx.cwd)) return 'en la carpeta del proyecto';
  const shown = ctx.root ? path.relative(path.resolve(ctx.root), base) || '.' : base;
  return `en la carpeta del proyecto ni en las superiores hasta ${shown}`;
}

/** What to do when the file lives outside the project folder. */
export const declareHint = (kind) =>
  `Si vive fuera del proyecto, declara su carpeta en "shared.${kind}" o en "locations.${kind}" del manifiesto.`;
