import path from 'node:path';
import { problemsResult } from '../../lib/problems.mjs';
import { effectiveOptions, loadRootTsconfig } from '../../lib/tsconfig.mjs';

export const id = 'typing/typescript-extras';
export const title = 'Opciones adicionales de TypeScript';
export const profile = 'angular';
export const level = 'C';

// Not part of `strict`; all three are off unless they are set.
const MUST_BE_TRUE = ['noImplicitOverride', 'noImplicitReturns', 'noFallthroughCasesInSwitch'];

export function run({ cwd }) {
  const root = loadRootTsconfig(cwd);
  // A missing or unreadable tsconfig.json is reported once, by typing/typescript-strict.
  if (root.problem) return { id, title, status: 'skip', message: `${root.problem}; lo señala typing/typescript-strict.` };

  const options = effectiveOptions(root.chain);
  const where = (flag) => path.relative(cwd, options[flag].file) || path.basename(options[flag].file);
  const problems = MUST_BE_TRUE.filter((flag) => options[flag]?.value !== true).map((flag) =>
    options[flag] ? `${flag}: ${options[flag].value} (${where(flag)}); debe ser true.` : `${flag}: no definido; debe ser true.`,
  );
  // Since TypeScript 5 this one is true unless it is turned off, so only an explicit false fails.
  if (options.forceConsistentCasingInFileNames?.value === false) {
    problems.push(`forceConsistentCasingInFileNames: false (${where('forceConsistentCasingInFileNames')}); debe ser true.`);
  }

  return (
    problemsResult({ id, title }, 'compilerOptions', problems, 'Activa esas opciones en "compilerOptions" del tsconfig.json.') ?? {
      id, title, status: 'pass', message: 'noImplicitOverride, noImplicitReturns, noFallthroughCasesInSwitch y mayúsculas coherentes.',
    }
  );
}
