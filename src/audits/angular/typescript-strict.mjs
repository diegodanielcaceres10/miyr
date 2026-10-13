import fs from 'node:fs';
import path from 'node:path';
import { effectiveOptions, loadTsconfigChain } from '../../lib/tsconfig.mjs';

export const id = 'angular/typescript-strict';
export const title = 'TypeScript strict mode habilitado';

// Flags enabled by `strict: true` (each one can be overridden individually).
const STRICT_FAMILY = [
  'noImplicitAny',
  'strictNullChecks',
  'strictFunctionTypes',
  'strictBindCallApply',
  'strictPropertyInitialization',
  'noImplicitThis',
  'useUnknownInCatchVariables',
  'alwaysStrict',
];

const rel = (cwd, file) => path.relative(cwd, file) || path.basename(file);

export function run({ cwd }) {
  const entry = path.join(cwd, 'tsconfig.json');

  if (!fs.existsSync(entry)) {
    return { id, title, status: 'fail', severity: 'high', message: 'No existe tsconfig.json en la raíz.' };
  }

  let options;
  try {
    options = effectiveOptions(loadTsconfigChain(entry));
  } catch (err) {
    return { id, title, status: 'error', severity: 'high', message: `tsconfig.json inválido: ${err.message}` };
  }

  const strict = options.strict?.value === true;
  const evidence = {
    strict: options.strict ? { value: options.strict.value, file: rel(cwd, options.strict.file) } : null,
  };

  if (!strict) {
    return {
      id, title, status: 'fail', severity: 'high', evidence,
      message: 'compilerOptions.strict no es true.',
      fix: 'Añade "strict": true en compilerOptions de tsconfig.json.',
    };
  }

  // Effective value of each flag: the explicit one, or `strict` when unset.
  const disabled = STRICT_FAMILY.filter((flag) => (options[flag]?.value ?? strict) === false);
  if (disabled.length > 0) {
    const weakened = disabled.map((flag) => `${flag}: false (${rel(cwd, options[flag].file)})`);
    return {
      id, title, status: 'fail', severity: 'medium', evidence: { ...evidence, weakened },
      message: `strict está en true pero se desactivan flags: ${disabled.join(', ')}.`,
      fix: 'Elimina esas sobrescrituras o justifícalas explícitamente.',
    };
  }

  return { id, title, status: 'pass', severity: 'high', evidence, message: 'strict: true y sin flags debilitados.' };
}
