import { findFile, readText } from '../../lib/files.mjs';
import { loadPackage } from '../../lib/package-json.mjs';

export const id = 'config/node-version';
export const title = 'Versión de Node y gestor de paquetes fijados';
export const profile = 'node';

export function run({ cwd }) {
  const { pkg, failure } = loadPackage(cwd);
  if (failure) return { id, title, severity: 'medium', ...failure };

  const missing = [];
  if (typeof pkg.engines?.node !== 'string' || pkg.engines.node.trim() === '') missing.push('engines.node');
  const versionFile = findFile(cwd, ['.nvmrc', '.node-version']);
  if (!versionFile || readText(versionFile).trim() === '') missing.push('.nvmrc o .node-version');
  if (!/^(npm|yarn|pnpm|bun)@\d/.test(String(pkg.packageManager ?? ''))) {
    missing.push('packageManager (por ejemplo npm@10.9.0)');
  }

  if (missing.length > 0) {
    return {
      id, title, status: 'fail', severity: 'medium', evidence: { missing },
      message: `Falta: ${missing.join(', ')}.`,
      fix: 'Declara la versión de Node en "engines", un archivo .nvmrc y el gestor en "packageManager".',
    };
  }

  return { id, title, status: 'pass', severity: 'medium', message: 'Node y gestor de paquetes fijados.' };
}
