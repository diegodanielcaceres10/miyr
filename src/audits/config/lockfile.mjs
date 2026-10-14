import fs from 'node:fs';
import path from 'node:path';
import { findFile, readText } from '../../lib/files.mjs';
import { isIgnored } from '../../lib/gitignore.mjs';
import { loadPackage } from '../../lib/package-json.mjs';

export const id = 'config/lockfile';
export const title = 'Un único lockfile versionado';
export const profile = 'node';

const LOCKFILES = {
  'package-lock.json': 'npm',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  'bun.lock': 'bun',
  'bun.lockb': 'bun',
};

const fail = (message, fix, evidence) => ({ id, title, status: 'fail', severity: 'high', message, fix, evidence });

export function run({ cwd }) {
  const present = Object.keys(LOCKFILES).filter((name) => fs.existsSync(path.join(cwd, name)));
  if (present.length === 0) {
    return fail('No hay lockfile (package-lock.json, yarn.lock, pnpm-lock.yaml o bun.lock).', 'Instala las dependencias y versiona el lockfile generado.');
  }

  const managers = new Set(present.map((name) => LOCKFILES[name]));
  if (managers.size > 1) {
    return fail(`Conviven lockfiles de gestores distintos: ${present.join(', ')}.`, 'Conserva solo el del gestor que uses.', { present });
  }

  const gitignore = findFile(cwd, ['.gitignore']);
  const text = gitignore ? readText(gitignore) : '';
  const ignored = present.filter((name) => isIgnored(text, name));
  if (ignored.length > 0) {
    return fail(`El lockfile está ignorado en .gitignore: ${ignored.join(', ')}.`, 'Quita esa regla de .gitignore para versionar el lockfile.', { ignored });
  }

  // Best effort: when package.json cannot be read, the manager check is skipped.
  const { pkg } = loadPackage(cwd);
  const declared = typeof pkg?.packageManager === 'string' ? pkg.packageManager.split('@')[0] : null;
  const actual = [...managers][0];
  if (declared && declared !== actual) {
    return fail(`packageManager declara ${declared} pero el lockfile es de ${actual} (${present[0]}).`, 'Alinea packageManager con el lockfile.', { declared, actual });
  }

  return { id, title, status: 'pass', severity: 'high', evidence: { lockfile: present[0] }, message: `Lockfile único: ${present[0]}.` };
}
