import { declareHint, whereSearched } from '../../lib/context.mjs';
import { gitignoreFiles, isIgnoredInRepo } from '../../lib/gitignore.mjs';

export const id = 'config/gitignore';
export const title = '.gitignore excluye node_modules';
export const profile = 'node';
export const level = 'D';

export function run(ctx) {
  if (gitignoreFiles(ctx).length === 0) {
    return {
      id, title, status: 'fail',
      message: `No se encontró ningún .gitignore ${whereSearched(ctx, 'gitignore')}.`,
      fix: `Crea un .gitignore que excluya node_modules. ${declareHint('gitignore')}`,
    };
  }
  if (!isIgnoredInRepo(ctx, 'node_modules')) {
    return { id, title, status: 'fail', message: '.gitignore no excluye node_modules.', fix: 'Añade "node_modules" a .gitignore.' };
  }
  return { id, title, status: 'pass', message: 'node_modules ignorado.' };
}
