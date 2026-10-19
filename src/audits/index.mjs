import fs from 'node:fs';
import path from 'node:path';
import * as ciWorkflow from './ci/workflow.mjs';
import * as dependencies from './config/dependencies.mjs';
import * as editorconfig from './config/editorconfig.mjs';
import * as gitignore from './config/gitignore.mjs';
import * as lockfile from './config/lockfile.mjs';
import * as nodeVersion from './config/node-version.mjs';
import * as packageMetadata from './config/package-metadata.mjs';
import * as packageScripts from './config/package-scripts.mjs';
import * as license from './docs/license.mjs';
import * as readme from './docs/readme.mjs';
import * as typescriptStrict from './typing/typescript-strict.mjs';

// Checks live in one folder per area (config, typing, ci, docs). Each one declares the profile it belongs
// to and its level of importance: A (foundation of the environment), B (build contract), C (code
// consistency) or D (repository hygiene). The level sets the severity of its results and the order in
// which checks are listed. Within a level the order below is kept. Register new checks here.
export const LEVELS = ['A', 'B', 'C', 'D'];
export const SEVERITY = { A: 'critical', B: 'high', C: 'medium', D: 'low' };

/** Most important level first; checks of the same level keep the order they were given in. */
export const sortByLevel = (list) => [...list].sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));

const checks = sortByLevel([
  lockfile,
  nodeVersion,
  dependencies,
  packageScripts,
  typescriptStrict,
  ciWorkflow,
  readme,
  license,
  gitignore,
  packageMetadata,
  editorconfig,
]);

// Stack profiles extend the previous one: core < node < angular.
const PROFILE_INCLUDES = {
  core: ['core'],
  node: ['core', 'node'],
  angular: ['core', 'node', 'angular'],
};

export const profiles = Object.fromEntries(
  Object.entries(PROFILE_INCLUDES).map(([name, included]) => [name, checks.filter((check) => included.includes(check.profile))]),
);

// Profiles whose checks all read package.json. Without it they would fail one by one for a single cause.
const NEEDS_PACKAGE_JSON = new Set(['node', 'angular']);

export function runAudit(profile, ctx) {
  const selected = profiles[profile];
  if (!selected) throw new Error(`Perfil desconocido: ${profile}`);
  if (NEEDS_PACKAGE_JSON.has(profile) && !fs.existsSync(path.join(ctx.cwd, 'package.json'))) {
    return [
      {
        id: 'config/project',
        title: 'Carpeta del proyecto',
        status: 'fail',
        severity: SEVERITY.A,
        message: `No hay package.json en ${ctx.cwd}: no parece un proyecto ${profile}.`,
        fix: 'Revisa "path" y "profile" de este proyecto en .miyr.json.',
      },
    ];
  }
  return selected.map((check) => ({ ...check.run(ctx), severity: SEVERITY[check.level] }));
}
