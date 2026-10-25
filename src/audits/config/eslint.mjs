import path from 'node:path';
import { declareHint, findUp, whereSearched } from '../../lib/context.mjs';
import { parseJsonc } from '../../lib/jsonc.mjs';
import { readText } from '../../lib/files.mjs';
import { lockedVersions } from '../../lib/lockfile-versions.mjs';
import { loadPackage } from '../../lib/package-json.mjs';
import { problemsResult } from '../../lib/problems.mjs';
import { majorOf } from '../../lib/versions.mjs';

export const id = 'config/eslint';
export const title = 'ESLint configurado (formato nuevo)';
export const profile = 'node';
export const level = 'C';

// The new "flat" config format; the old .eslintrc* files and the eslintConfig key are rejected.
export const FLAT_CONFIGS = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts', 'eslint.config.cts'];
const LEGACY_CONFIGS = ['.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.yaml', '.eslintrc.yml'];
const MIN_MAJOR = 9;
const ANGULAR_PLUGINS = ['angular-eslint', 'typescript-eslint'];
const ANGULAR_BUILDER = '@angular-eslint/builder:lint';

/** Whether angular.json has a lint target that uses the angular-eslint builder (targets were once called architect). */
function hasAngularLintTarget(cwd) {
  try {
    const { projects = {} } = parseJsonc(readText(path.join(cwd, 'angular.json')));
    return Object.values(projects).some((project) => [project?.architect, project?.targets].some((t) => t?.lint?.builder === ANGULAR_BUILDER));
  } catch {
    return false;
  }
}

export function run(ctx) {
  const { pkg, failure } = loadPackage(ctx.cwd);
  if (failure) return { id, title, ...failure };

  const problems = [];
  let fix;
  const has = (name) => pkg.dependencies?.[name] !== undefined || pkg.devDependencies?.[name] !== undefined;

  if (!findUp(ctx, 'eslint', FLAT_CONFIGS)) {
    const legacy = findUp(ctx, 'eslint', LEGACY_CONFIGS);
    if (legacy || pkg.eslintConfig !== undefined) {
      problems.push(`La configuración de ESLint usa el formato antiguo (${legacy ? path.basename(legacy) : 'eslintConfig en package.json'}); migra a eslint.config.js.`);
    } else {
      problems.push(`No se encontró eslint.config.* ${whereSearched(ctx, 'eslint')}.`);
      fix = declareHint('eslint');
    }
  }

  if (!has('eslint')) {
    problems.push('Falta eslint en las dependencias.');
  } else {
    const locked = lockedVersions(ctx.cwd, ['eslint'])?.versions.eslint;
    const text = locked ?? pkg.dependencies?.eslint ?? pkg.devDependencies?.eslint;
    const major = majorOf(text);
    if (major !== null && major < MIN_MAJOR) {
      problems.push(`eslint ${text} (${locked ? 'package-lock.json' : 'rango declarado en package.json'}): el formato nuevo exige la versión ${MIN_MAJOR} o posterior.`);
    }
  }

  if (has('@angular/core')) {
    const missing = ANGULAR_PLUGINS.filter((name) => !has(name));
    if (missing.length > 0) problems.push(`Faltan en las dependencias: ${missing.join(', ')}.`);
  }

  const lint = pkg.scripts?.lint;
  if (typeof lint !== 'string' || !/\beslint\b|\bng\s+lint\b/.test(lint)) {
    problems.push('El script "lint" no ejecuta eslint ni ng lint.');
  } else if (/\bng\s+lint\b/.test(lint) && !hasAngularLintTarget(ctx.cwd)) {
    problems.push(`"ng lint" necesita un target "lint" con el builder ${ANGULAR_BUILDER} en angular.json, y no se encontró.`);
  }

  return problemsResult({ id, title }, 'ESLint', problems, fix) ?? { id, title, status: 'pass', message: 'ESLint con configuración nueva, versión 9 o posterior y script lint.' };
}
