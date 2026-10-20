import { declareHint, findUp } from '../../lib/context.mjs';
import { readText } from '../../lib/files.mjs';
import { loadPackage } from '../../lib/package-json.mjs';

export const id = 'config/node-version';
export const title = 'Versión de Node y gestor de paquetes fijados';
export const profile = 'node';
export const level = 'A';

export function run(ctx) {
  const { pkg, failure } = loadPackage(ctx.cwd);
  if (failure) return { id, title, ...failure };

  const missing = [];
  if (typeof pkg.engines?.node !== 'string' || pkg.engines.node.trim() === '') missing.push('engines.node');
  const versionFile = findUp(ctx, 'node-version', ['.nvmrc', '.node-version']);
  if (!versionFile || readText(versionFile).trim() === '') missing.push('.nvmrc o .node-version');
  if (!/^(npm|yarn|pnpm|bun)@\d/.test(String(pkg.packageManager ?? ''))) {
    missing.push('packageManager (por ejemplo npm@10.9.0)');
  }

  if (missing.length > 0) {
    return {
      id, title, status: 'fail', evidence: { missing },
      message: `Falta: ${missing.join(', ')}.`,
      fix: ['Declara la versión de Node en "engines", un archivo .nvmrc y el gestor en "packageManager".', versionFile ? '' : declareHint('node-version')]
        .filter(Boolean)
        .join(' '),
    };
  }

  return { id, title, status: 'pass', message: 'Node y gestor de paquetes fijados.' };
}
