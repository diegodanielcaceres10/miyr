import path from 'node:path';
import { LICENSE_FILES, findFile, readText } from '../../lib/files.mjs';

export const id = 'docs/license';
export const title = 'LICENSE presente';
export const profile = 'core';

export function run({ cwd }) {
  const file = findFile(cwd, LICENSE_FILES);
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
