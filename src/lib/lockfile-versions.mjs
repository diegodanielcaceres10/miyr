import path from 'node:path';
import { readJson } from './files.mjs';

/**
 * Exact versions that package-lock.json resolved for the given packages (top-level installs only).
 * Returns { file, versions } or null when there is no readable package-lock.json.
 * Other lockfile formats are not read yet.
 */
export function lockedVersions(cwd, names) {
  let lock;
  try {
    lock = readJson(path.join(cwd, 'package-lock.json'));
  } catch {
    return null; // missing or unreadable
  }
  const versions = {};
  for (const name of names) {
    // v2 and v3 list installs under "packages"; v1 (and v2 for compatibility) under "dependencies".
    const version = lock?.packages?.[`node_modules/${name}`]?.version ?? lock?.dependencies?.[name]?.version;
    if (typeof version === 'string') versions[name] = version;
  }
  return { file: 'package-lock.json', versions };
}
