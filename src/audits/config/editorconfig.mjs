import path from 'node:path';
import { findFile, readText } from '../../lib/files.mjs';

export const id = 'config/editorconfig';
export const title = '.editorconfig definido';
export const profile = 'core';

// Keys that must be set in the global [*] section.
const REQUIRED_KEYS = ['indent_style', 'indent_size', 'end_of_line', 'charset', 'insert_final_newline'];

function parse(text) {
  const root = {};
  const sections = {};
  let current = root;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const section = line.match(/^\[(.+)\]$/);
    if (section) {
      current = sections[section[1]] ??= {};
      continue;
    }
    const pair = line.match(/^([^=:]+?)\s*[=:]\s*(.*)$/);
    if (pair) current[pair[1].trim().toLowerCase()] = pair[2].trim().toLowerCase();
  }
  return { root, sections };
}

export function run({ cwd }) {
  const file = findFile(cwd, ['.editorconfig']);
  if (!file) {
    return { id, title, status: 'fail', severity: 'medium', message: 'No existe .editorconfig en la raíz.' };
  }

  const { root, sections } = parse(readText(file));
  const global = sections['*'] ?? {};
  const missing = [
    ...(root.root === 'true' ? [] : ['root = true']),
    ...REQUIRED_KEYS.filter((key) => !global[key]),
  ];

  if (missing.length > 0) {
    return {
      id, title, status: 'fail', severity: 'medium', evidence: { file: path.basename(file), missing },
      message: `.editorconfig incompleto. Falta: ${missing.join(', ')}.`,
      fix: 'Declara "root = true" y esas claves en la sección [*].',
    };
  }

  return { id, title, status: 'pass', severity: 'medium', message: '.editorconfig completo.' };
}
