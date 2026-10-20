import path from 'node:path';
import { declareHint, findUp, whereSearched } from '../../lib/context.mjs';
import { LICENSE_FILES, readText } from '../../lib/files.mjs';

export const id = 'docs/license';
export const title = 'LICENSE presente';
export const profile = 'core';
export const level = 'C';

export function run(ctx) {
  const file = findUp(ctx, 'license', LICENSE_FILES);
  if (!file) {
    return {
      id, title, status: 'fail',
      message: `No se encontró un archivo LICENSE ${whereSearched(ctx, 'license')}.`,
      fix: `Añade un archivo LICENSE con la licencia elegida. ${declareHint('license')}`,
    };
  }
  if (readText(file).trim() === '') {
    return { id, title, status: 'fail', message: `${path.basename(file)} está vacío.` };
  }
  return { id, title, status: 'pass', evidence: { file: path.basename(file) }, message: `Licencia en ${path.basename(file)}.` };
}
