import fs from 'node:fs';
import path from 'node:path';
import { problemsResult } from '../../lib/problems.mjs';
import { loadRootTsconfig, loadTsconfigChain } from '../../lib/tsconfig.mjs';

export const id = 'typing/tsconfig-inheritance';
export const title = 'Los tsconfig derivados extienden el tsconfig.json raíz';
export const profile = 'angular';
export const level = 'B';

// tsconfig.app.json, tsconfig.spec.json... The base file is what the others build on, not one of them.
const DERIVED = /^tsconfig\..+\.json$/i;

export function run({ cwd }) {
  const root = loadRootTsconfig(cwd);
  // A missing or unreadable tsconfig.json is reported once, by typing/typescript-strict.
  if (root.problem) return { id, title, status: 'skip', message: `${root.problem}; lo señala typing/typescript-strict.` };

  // Files that the root config itself extends are part of its chain, so they are not asked to extend it.
  const inRootChain = new Set(root.chain.map((entry) => path.resolve(entry.file)));
  const rootEntry = path.resolve(root.entry);
  const names = fs
    .readdirSync(cwd, { withFileTypes: true })
    .filter((entry) => !entry.isDirectory() && DERIVED.test(entry.name) && entry.name.toLowerCase() !== 'tsconfig.base.json')
    .map((entry) => entry.name)
    .filter((name) => !inRootChain.has(path.resolve(cwd, name)))
    .sort();

  if (names.length === 0) {
    return { id, title, status: 'pass', evidence: { checked: [] }, message: 'No hay tsconfig.*.json derivados que comprobar.' };
  }

  const problems = [];
  for (const name of names) {
    try {
      const chain = loadTsconfigChain(path.join(cwd, name));
      // Without this link the options of the root config (strict, for one) are not applied to what that file compiles.
      if (!chain.some((entry) => path.resolve(entry.file) === rootEntry)) {
        problems.push(`${name} no extiende tsconfig.json (ni directa ni indirectamente).`);
      }
    } catch (err) {
      problems.push(`${name}: no se pudo leer (${err.message}).`);
    }
  }

  return (
    problemsResult({ id, title }, 'tsconfig', problems, 'Añade "extends": "./tsconfig.json" a esos archivos.') ?? {
      id, title, status: 'pass', evidence: { checked: names }, message: `${names.join(', ')} extienden tsconfig.json.`,
    }
  );
}
