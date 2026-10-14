import { findFile, readText } from '../../lib/files.mjs';
import { isIgnored } from '../../lib/gitignore.mjs';

export const id = 'config/gitignore';
export const title = '.gitignore excluye node_modules';
export const profile = 'node';

export function run({ cwd }) {
  const file = findFile(cwd, ['.gitignore']);
  if (!file) {
    return { id, title, status: 'fail', severity: 'high', message: 'No existe .gitignore en la raíz.', fix: 'Crea un .gitignore que excluya node_modules.' };
  }
  if (!isIgnored(readText(file), 'node_modules')) {
    return { id, title, status: 'fail', severity: 'high', message: '.gitignore no excluye node_modules.', fix: 'Añade "node_modules" a .gitignore.' };
  }
  return { id, title, status: 'pass', severity: 'high', message: 'node_modules ignorado.' };
}
