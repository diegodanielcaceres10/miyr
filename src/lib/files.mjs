import fs from 'node:fs';
import path from 'node:path';

/** Finds a file in `dir` by name, ignoring case. Returns its absolute path or null. */
export function findFile(dir, names) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const files = new Map(entries.filter((e) => !e.isDirectory()).map((e) => [e.name.toLowerCase(), e.name]));
  for (const name of names) {
    const match = files.get(name.toLowerCase());
    if (match) return path.join(dir, match);
  }
  return null;
}

export const readText = (file) => fs.readFileSync(file, 'utf8');

/** Reads strict JSON; tolerates the UTF-8 BOM that some Windows editors add. */
export const readJson = (file) => JSON.parse(readText(file).replace(/^\uFEFF/, ''));
