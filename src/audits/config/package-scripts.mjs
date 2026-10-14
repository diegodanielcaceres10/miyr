import { loadPackage } from '../../lib/package-json.mjs';

export const id = 'config/package-scripts';
export const title = 'Scripts estándar en package.json';
export const profile = 'node';

const REQUIRED = ['start', 'build', 'test', 'lint'];

export function run({ cwd }) {
  const { pkg, failure } = loadPackage(cwd);
  if (failure) return { id, title, severity: 'high', ...failure };

  const scripts = pkg.scripts ?? {};
  const missing = REQUIRED.filter((name) => typeof scripts[name] !== 'string' || scripts[name].trim() === '');

  if (missing.length > 0) {
    return {
      id, title, status: 'fail', severity: 'high', evidence: { missing },
      message: `Faltan scripts obligatorios: ${missing.join(', ')}.`,
      fix: `Define ${missing.map((m) => `"${m}"`).join(', ')} en "scripts" de package.json.`,
    };
  }

  return { id, title, status: 'pass', severity: 'high', message: `Scripts presentes: ${REQUIRED.join(', ')}.` };
}
