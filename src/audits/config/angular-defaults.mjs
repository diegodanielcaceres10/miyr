import path from 'node:path';
import { parseJsonc } from '../../lib/jsonc.mjs';
import { readText } from '../../lib/files.mjs';
import { lockedVersions } from '../../lib/lockfile-versions.mjs';
import { loadPackage } from '../../lib/package-json.mjs';
import { problemsResult } from '../../lib/problems.mjs';
import { majorOf } from '../../lib/versions.mjs';

export const id = 'config/angular-defaults';
export const title = 'Valores por defecto de Angular (standalone y estilo)';
export const profile = 'angular';
export const level = 'C';

const COMPONENT = '@schematics/angular:component';
const STANDALONE_KINDS = [COMPONENT, '@schematics/angular:directive', '@schematics/angular:pipe'];
// From this version on, standalone is what the schematics generate unless told otherwise.
const STANDALONE_BY_DEFAULT = 19;
const CSS_ONLY_WITH = 'tailwindcss';

export function run(ctx) {
  const { pkg, failure } = loadPackage(ctx.cwd);
  if (failure) return { id, title, ...failure };

  let angular;
  try {
    angular = parseJsonc(readText(path.join(ctx.cwd, 'angular.json')));
  } catch (err) {
    const message = err.code === 'ENOENT' ? 'No existe angular.json en la carpeta del proyecto.' : `angular.json no se pudo leer: ${err.message}`;
    return { id, title, status: 'fail', message };
  }

  const apps = Object.entries(angular?.projects ?? {}).filter(([, project]) => project?.projectType === 'application');
  if (apps.length === 0) {
    return { id, title, status: 'fail', message: 'angular.json no declara ninguna aplicación (projectType "application").' };
  }

  const has = (name) => pkg.dependencies?.[name] !== undefined || pkg.devDependencies?.[name] !== undefined;
  const coreText = lockedVersions(ctx.cwd, ['@angular/core'])?.versions['@angular/core'] ?? pkg.dependencies?.['@angular/core'] ?? pkg.devDependencies?.['@angular/core'];
  const major = majorOf(coreText);

  // What a project sets overrides what angular.json sets at its root, option by option.
  const schematic = (project, name) => ({ ...angular.schematics?.[name], ...project.schematics?.[name] });

  const problems = [];
  for (const [name, project] of apps) {
    const style = schematic(project, COMPONENT).style ?? 'css';
    if (!(style === 'scss' || style === 'sass' || (style === 'css' && has(CSS_ONLY_WITH)))) {
      const why = style === 'css' ? ` (solo se acepta con ${CSS_ONLY_WITH})` : '';
      problems.push(`${name}: el estilo por defecto de los componentes es "${style}"${why}; usa scss o sass.`);
    }

    const implicit = [];
    for (const kind of STANDALONE_KINDS) {
      const standalone = schematic(project, kind).standalone;
      if (standalone === false) problems.push(`${name}: ${kind} tiene standalone: false; el estándar es standalone.`);
      else if (standalone !== true && major !== null && major < STANDALONE_BY_DEFAULT) implicit.push(kind);
    }
    if (implicit.length > 0) {
      problems.push(`${name}: falta standalone: true en ${implicit.join(', ')} (Angular ${major} no lo activa por defecto).`);
    }
  }

  return problemsResult({ id, title }, 'Angular', problems) ?? { id, title, status: 'pass', message: 'Estilo scss/sass y componentes standalone por defecto.' };
}
