import path from 'node:path';
import { declareHint, findUp, whereSearched } from '../../lib/context.mjs';
import { parseEditorconfig } from '../../lib/editorconfig.mjs';
import { readText } from '../../lib/files.mjs';

export const id = 'config/editorconfig';
export const title = '.editorconfig definido';
export const profile = 'core';
export const level = 'D';

// Keys that must be set in the global [*] section.
const REQUIRED_KEYS = ['indent_style', 'indent_size', 'end_of_line', 'charset', 'insert_final_newline'];

export function run(ctx) {
  const file = findUp(ctx, 'editorconfig', ['.editorconfig']);
  if (!file) {
    return {
      id, title, status: 'fail',
      message: `No se encontró .editorconfig ${whereSearched(ctx, 'editorconfig')}.`,
      fix: `Crea un .editorconfig. ${declareHint('editorconfig')}`,
    };
  }

  const { root, sections } = parseEditorconfig(readText(file));
  const global = sections['*'] ?? {};
  const missing = [
    ...(root.root === 'true' ? [] : ['root = true']),
    ...REQUIRED_KEYS.filter((key) => !global[key]),
  ];

  if (missing.length > 0) {
    return {
      id, title, status: 'fail', evidence: { file: path.relative(ctx.root ?? ctx.cwd, file), missing },
      message: `.editorconfig incompleto. Falta: ${missing.join(', ')}.`,
      fix: 'Declara "root = true" y esas claves en la sección [*].',
    };
  }

  return { id, title, status: 'pass', message: '.editorconfig completo.' };
}
