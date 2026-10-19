import { loadPackage } from '../../lib/package-json.mjs';

export const id = 'config/dependencies';
export const title = 'Higiene de dependencias';
export const profile = 'node';
export const level = 'A';

const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];
const LOOSE = new Set(['', '*', 'x', 'latest']);
// Development tooling that must not ship as a runtime dependency.
const TOOLING = /^(eslint(-.+)?|@eslint\/.+|@typescript-eslint\/.+|typescript-eslint|angular-eslint|@angular-eslint\/.+|prettier(-.+)?|jest(-.+)?|ts-jest|vitest(-.+)?|karma(-.+)?|jasmine-core|@types\/.+)$/;

export function run({ cwd }) {
  const { pkg, failure } = loadPackage(cwd);
  if (failure) return { id, title, ...failure };

  const runtime = Object.keys(pkg.dependencies ?? {});
  const loose = [
    ...new Set(
      SECTIONS.flatMap((section) =>
        Object.entries(pkg[section] ?? {})
          .filter(([, range]) => LOOSE.has(String(range).trim().toLowerCase()))
          .map(([name]) => name),
      ),
    ),
  ];
  const duplicated = runtime.filter((name) => name in (pkg.devDependencies ?? {}));
  const tooling = runtime.filter((name) => TOOLING.test(name));

  const problems = [];
  if (loose.length > 0) problems.push(`rangos sin acotar (*, latest, x): ${loose.join(', ')}`);
  if (duplicated.length > 0) problems.push(`repetidas en dependencies y devDependencies: ${duplicated.join(', ')}`);
  if (tooling.length > 0) problems.push(`herramientas de desarrollo en dependencies: ${tooling.join(', ')}`);

  if (problems.length > 0) {
    return {
      id, title, status: 'fail', evidence: { problems },
      message: problems.join('; ') + '.',
      fix: 'Acota los rangos, elimina duplicados y mueve las herramientas a devDependencies.',
    };
  }

  return { id, title, status: 'pass', message: 'Dependencias sin rangos abiertos, duplicados ni herramientas mal ubicadas.' };
}
