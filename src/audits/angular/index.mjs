import * as typescriptStrict from './typescript-strict.mjs';

// Register every new Angular check here.
export const checks = [typescriptStrict];

export function runAngularAudit(ctx) {
  return checks.map((check) => check.run(ctx));
}
