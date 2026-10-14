import path from 'node:path';
import { findFile, readText } from '../../lib/files.mjs';

export const id = 'core/license';
export const title = 'LICENSE presente';

const NAMES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'LICENCE.txt', 'COPYING'];

export function run({ cwd }) {
  const file = findFile(cwd, NAMES);
  if (!file) {
    return {
      id, title, status: 'fail', severity: 'medium',
      message: 'No existe un archivo LICENSE.',
      fix: 'Añade un archivo LICENSE con la licencia elegida.',
    };
  }
  if (readText(file).trim() === '') {
    return { id, title, status: 'fail', severity: 'medium', message: `${path.basename(file)} está vacío.` };
  }
  return { id, title, status: 'pass', severity: 'medium', evidence: { file: path.basename(file) }, message: `Licencia en ${path.basename(file)}.` };
}
