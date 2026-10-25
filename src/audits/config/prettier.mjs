import path from 'node:path';
import { declareHint, findUp, whereSearched } from '../../lib/context.mjs';
import { parseEditorconfig } from '../../lib/editorconfig.mjs';
import { readText } from '../../lib/files.mjs';
import { loadPackage } from '../../lib/package-json.mjs';
import { problemsResult } from '../../lib/problems.mjs';
import { readPrettierOptions } from '../../lib/prettier-options.mjs';
import { FLAT_CONFIGS } from './eslint.mjs';

export const id = 'config/prettier';
export const title = 'Prettier configurado y coherente con .editorconfig';
export const profile = 'node';
export const level = 'C';

const CONFIG_FILES = [
  '.prettierrc', '.prettierrc.json', '.prettierrc.yaml', '.prettierrc.yml', '.prettierrc.json5', '.prettierrc.toml',
  '.prettierrc.js', '.prettierrc.cjs', '.prettierrc.mjs', '.prettierrc.ts', '.prettierrc.cts', '.prettierrc.mts',
  'prettier.config.js', 'prettier.config.cjs', 'prettier.config.mjs', 'prettier.config.ts', 'prettier.config.cts', 'prettier.config.mts',
];
const PRINT_WIDTH = 150;
const PRETTIER_DEFAULT_WIDTH = 80;

const number = (value) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : typeof value === 'number' ? value : null);

export function run(ctx) {
  const { pkg, failure } = loadPackage(ctx.cwd);
  if (failure) return { id, title, ...failure };

  const problems = [];
  let fix;
  let options = null;
  let unreadable = null;

  const file = findUp(ctx, 'prettier', CONFIG_FILES);
  if (file || pkg.prettier !== undefined) {
    const read = file ? readPrettierOptions(path.dirname(file), path.basename(file)) : readPrettierOptions(ctx.cwd, 'package.json');
    if (read.options) options = read.options;
    else unreadable = read.unreadable;
  } else {
    problems.push(`No se encontró una configuración de Prettier ${whereSearched(ctx, 'prettier')}.`);
    fix = declareHint('prettier');
  }

  const has = (name) => pkg.dependencies?.[name] !== undefined || pkg.devDependencies?.[name] !== undefined;
  const missing = ['prettier', 'eslint-config-prettier'].filter((name) => !has(name));
  if (missing.length > 0) problems.push(`Faltan en las dependencias: ${missing.join(', ')}.`);

  if (typeof pkg.scripts?.format !== 'string' || pkg.scripts.format.trim() === '') problems.push('Falta el script "format" en package.json.');

  // Installing eslint-config-prettier does nothing unless the ESLint config uses it.
  const eslintFile = has('eslint-config-prettier') ? findUp(ctx, 'eslint', FLAT_CONFIGS) : null;
  if (eslintFile && !/eslint-config-prettier/.test(readText(eslintFile))) {
    problems.push(`eslint-config-prettier está instalado pero la configuración de ESLint (${path.basename(eslintFile)}) no lo usa.`);
  }

  if (options) {
    const editorFile = findUp(ctx, 'editorconfig', ['.editorconfig']);
    const editor = (editorFile && parseEditorconfig(readText(editorFile)).sections['*']) || {};

    // Prettier reads these four values from .editorconfig when its own config does not set them,
    // so they only conflict when both declare them and differ.
    const widthP = number(options.printWidth);
    const widthE = number(editor.max_line_length);
    if (widthP !== null && widthE !== null && widthP !== widthE) {
      problems.push(`printWidth (${widthP}) y max_line_length de .editorconfig (${widthE}) no coinciden.`);
    }
    const width = widthP ?? widthE ?? PRETTIER_DEFAULT_WIDTH;
    if (width !== PRINT_WIDTH) {
      problems.push(`El ancho de línea efectivo es ${width}${widthP === null && widthE === null ? ' (Prettier usa 80 por defecto)' : ''}; debe ser ${PRINT_WIDTH} (printWidth).`);
    }

    const tabP = number(options.tabWidth);
    const tabE = number(editor.indent_size ?? editor.tab_width);
    if (tabP !== null && tabE !== null && tabP !== tabE) problems.push(`tabWidth (${tabP}) e indent_size de .editorconfig (${tabE}) no coinciden.`);

    const tabsE = { tab: true, space: false }[editor.indent_style];
    if (typeof options.useTabs === 'boolean' && tabsE !== undefined && options.useTabs !== tabsE) {
      problems.push(`useTabs (${options.useTabs}) e indent_style de .editorconfig (${editor.indent_style}) no coinciden.`);
    }

    const eol = ['lf', 'crlf', 'cr'];
    if (eol.includes(options.endOfLine) && eol.includes(editor.end_of_line) && options.endOfLine !== editor.end_of_line) {
      problems.push(`endOfLine (${options.endOfLine}) y end_of_line de .editorconfig (${editor.end_of_line}) no coinciden.`);
    }
  }

  const failed = problemsResult({ id, title }, 'Prettier', problems, fix);
  if (failed) return failed;
  if (unreadable) {
    return {
      id, title, status: 'skip',
      message: `No se pudo comprobar el ancho de línea ni la coherencia con .editorconfig: ${unreadable}.`,
      fix: 'Escribe la configuración en .prettierrc.json o .prettierrc.yaml si quieres que miyr la compruebe.',
    };
  }
  return { id, title, status: 'pass', message: `Prettier con ancho ${PRINT_WIDTH}, script format y eslint-config-prettier.` };
}
