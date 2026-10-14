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

// Checks live in one folder per area (config, typing, ci, docs). Each one declares the
// profile it belongs to; register new checks here, grouped by area.
const checks = [
  editorconfig,
  packageScripts,
  nodeVersion,
  lockfile,
  packageMetadata,
  dependencies,
  gitignore,
  typescriptStrict,
  ciWorkflow,
  readme,
  license,
];

// Stack profiles extend the previous level: core < node < angular.
const LEVELS = {
  core: ['core'],
  node: ['core', 'node'],
  angular: ['core', 'node', 'angular'],
};

export const profiles = Object.fromEntries(
  Object.entries(LEVELS).map(([name, levels]) => [name, checks.filter((check) => levels.includes(check.profile))]),
);

export function runAudit(profile, ctx) {
  const selected = profiles[profile];
  if (!selected) throw new Error(`Perfil desconocido: ${profile}`);
  return selected.map((check) => check.run(ctx));
}
