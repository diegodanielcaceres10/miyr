import path from 'node:path';
import { problemsResult } from '../../lib/problems.mjs';
import { effectiveOptions, loadRootTsconfig } from '../../lib/tsconfig.mjs';

export const id = 'typing/angular-compiler';
export const title = 'Opciones estrictas del compilador de Angular';
export const profile = 'angular';
export const level = 'B';

// Template type checking and injection are only strict when all three are on.
const FLAGS = ['strictTemplates', 'strictInjectionParameters', 'strictInputAccessModifiers'];

export function run({ cwd }) {
  const root = loadRootTsconfig(cwd);
  // A missing or unreadable tsconfig.json is reported once, by typing/typescript-strict.
  if (root.problem) return { id, title, status: 'skip', message: `${root.problem}; lo señala typing/typescript-strict.` };

  const options = effectiveOptions(root.chain, 'angularCompilerOptions');
  const problems = FLAGS.filter((flag) => options[flag]?.value !== true).map((flag) =>
    options[flag]
      ? `${flag}: ${options[flag].value} (${path.relative(cwd, options[flag].file) || path.basename(options[flag].file)}); debe ser true.`
      : `${flag}: no definido; debe ser true.`,
  );

  return (
    problemsResult({ id, title }, 'angularCompilerOptions', problems, 'Activa esas opciones en "angularCompilerOptions" del tsconfig.json.') ?? {
      id, title, status: 'pass', message: 'strictTemplates, strictInjectionParameters y strictInputAccessModifiers activados.',
    }
  );
}
