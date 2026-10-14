import * as angular from './angular/index.mjs';
import * as core from './core/index.mjs';

// Each profile is an ordered list of checks. Stack profiles extend the core ones.
export const profiles = {
  core: core.checks,
  angular: [...core.checks, ...angular.checks],
};

export function runAudit(profile, ctx) {
  const checks = profiles[profile];
  if (!checks) throw new Error(`Perfil desconocido: ${profile}`);
  return checks.map((check) => check.run(ctx));
}
