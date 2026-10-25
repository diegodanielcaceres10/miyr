import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as check from '../../../src/audits/config/prettier.mjs';
import { project } from '../../../test-support/project.mjs';

const { run } = check;
const PKG = { name: 'app', devDependencies: { prettier: '^3.3.0', 'eslint-config-prettier': '^10.0.0' }, scripts: { format: 'prettier --write .' } };
const ESLINT = "import eslintConfigPrettier from 'eslint-config-prettier';\nexport default [eslintConfigPrettier];\n";
const EDITORCONFIG = (lines = '') => `root = true\n\n[*]\ncharset = utf-8\n${lines}`;

// A project folder; null removes an entry.
function ws(overrides = {}) {
  const files = { 'package.json': PKG, '.prettierrc': { printWidth: 150 }, 'eslint.config.js': ESLINT, ...overrides };
  for (const [name, content] of Object.entries(files)) if (content === null) delete files[name];
  return project(files);
}
const ok = (overrides) => run({ cwd: ws(overrides) });
const rc = (options, extra = {}) => ok({ '.prettierrc': options, ...extra });

test('declares its place in the report', () => {
  assert.deepEqual([check.id, check.profile, check.level], ['config/prettier', 'node', 'C']);
});

test('fails when package.json is missing', () => {
  assert.equal(run({ cwd: project({}) }).status, 'fail');
});

test('passes with a config of printWidth 150, both packages and a format script', () => {
  assert.equal(ok().status, 'pass');
});

test('accepts the usual ways of writing the config', () => {
  const variants = {
    '.prettierrc.json': '{"printWidth":150}',
    '.prettierrc.yaml': 'printWidth: 150\n',
    '.prettierrc.yml': 'printWidth: 150\n',
    '.prettierrc.toml': 'printWidth = 150\n',
  };
  for (const [name, content] of Object.entries(variants)) assert.equal(ok({ '.prettierrc': null, [name]: content }).status, 'pass', name);
  assert.equal(ok({ '.prettierrc': null, 'package.json': { ...PKG, prettier: { printWidth: 150 } } }).status, 'pass');
});

test('with no config the failure says where it looked and how to point elsewhere', () => {
  const result = ok({ '.prettierrc': null });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /No se encontró.*Prettier/);
  assert.match(result.fix, /shared\.prettier/);
});

test('a config at a declared folder is found, and one above it is not', () => {
  const root = project({ '.prettierrc': '{"printWidth":150}', 'web/package.json': PKG });
  const cwd = path.join(root, 'web');
  assert.equal(run({ cwd, root, locations: { prettier: root } }).status, 'pass');
  assert.equal(run({ cwd, root }).status, 'fail');
});

test('prettier and eslint-config-prettier must both be installed', () => {
  const none = ok({ 'package.json': { ...PKG, devDependencies: {} } });
  assert.equal(none.status, 'fail');
  assert.match(none.message, /prettier/);
  assert.match(none.message, /eslint-config-prettier/);
  const only = ok({ 'package.json': { ...PKG, devDependencies: { prettier: '^3.0.0' } } });
  assert.match(only.message, /eslint-config-prettier/);
});

test('a format script is required', () => {
  for (const scripts of [{}, { format: '' }, { format: '  ' }]) {
    const result = ok({ 'package.json': { ...PKG, scripts } });
    assert.equal(result.status, 'fail', JSON.stringify(scripts));
    assert.match(result.message, /format/);
  }
});

test('printWidth must be 150', () => {
  const result = rc({ printWidth: 100 });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /printWidth/);
  assert.match(result.message, /100/);
  assert.match(result.message, /150/);
});

test('with no printWidth Prettier uses 80, so it fails', () => {
  const result = rc({ singleQuote: true });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /80/);
});

test('printWidth may come from max_line_length in .editorconfig', () => {
  assert.equal(rc({}, { '.editorconfig': EDITORCONFIG('max_line_length = 150\n') }).status, 'pass');
  const wrong = rc({}, { '.editorconfig': EDITORCONFIG('max_line_length = 100\n') });
  assert.equal(wrong.status, 'fail');
  assert.match(wrong.message, /100/);
});

test('printWidth and max_line_length must agree when both are declared', () => {
  assert.equal(rc({ printWidth: 150 }, { '.editorconfig': EDITORCONFIG('max_line_length = 150\n') }).status, 'pass');
  const result = rc({ printWidth: 150 }, { '.editorconfig': EDITORCONFIG('max_line_length = 120\n') });
  assert.equal(result.status, 'fail');
  assert.match(result.evidence?.details?.join(' ') ?? result.message, /max_line_length/);
});

test('tabWidth, useTabs and endOfLine must agree with .editorconfig when both are declared', () => {
  const base = { printWidth: 150 };
  assert.equal(rc({ ...base, tabWidth: 2 }, { '.editorconfig': EDITORCONFIG('indent_size = 2\n') }).status, 'pass');
  assert.equal(rc({ ...base, tabWidth: 4 }, { '.editorconfig': EDITORCONFIG('indent_size = 2\n') }).status, 'fail');
  assert.equal(rc({ ...base, useTabs: true }, { '.editorconfig': EDITORCONFIG('indent_style = space\n') }).status, 'fail');
  assert.equal(rc({ ...base, useTabs: false }, { '.editorconfig': EDITORCONFIG('indent_style = space\n') }).status, 'pass');
  assert.equal(rc({ ...base, endOfLine: 'crlf' }, { '.editorconfig': EDITORCONFIG('end_of_line = lf\n') }).status, 'fail');
  assert.equal(rc({ ...base, endOfLine: 'lf' }, { '.editorconfig': EDITORCONFIG('end_of_line = lf\n') }).status, 'pass');
});

test('a value declared only in .editorconfig is inherited, so it is coherent', () => {
  assert.equal(rc({ printWidth: 150 }, { '.editorconfig': EDITORCONFIG('indent_size = 4\nindent_style = tab\nend_of_line = crlf\n') }).status, 'pass');
});

test('values that cannot be compared are not flagged', () => {
  const base = { printWidth: 150 };
  assert.equal(rc({ ...base, tabWidth: 4 }, { '.editorconfig': EDITORCONFIG('indent_size = tab\n') }).status, 'pass');
  assert.equal(rc({ ...base, endOfLine: 'auto' }, { '.editorconfig': EDITORCONFIG('end_of_line = lf\n') }).status, 'pass');
});

test('a config written as code cannot be read: it is skipped, not approved or failed', () => {
  const result = ok({ '.prettierrc': null, 'prettier.config.mjs': 'export default { printWidth: 150 };\n' });
  assert.equal(result.status, 'skip');
  assert.match(result.message, /prettier\.config\.mjs/);
  assert.match(result.message, /código/);
});

test('a shared config named in package.json cannot be read either', () => {
  assert.equal(ok({ '.prettierrc': null, 'package.json': { ...PKG, prettier: '@company/prettier-config' } }).status, 'skip');
});

test('other problems still fail even when the config cannot be read', () => {
  const result = ok({ '.prettierrc': null, 'prettier.config.mjs': 'export default {};', 'package.json': { ...PKG, scripts: {} } });
  assert.equal(result.status, 'fail');
});

test('eslint-config-prettier installed but not used by the ESLint config fails', () => {
  const result = ok({ 'eslint.config.js': 'export default [];\n' });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /eslint-config-prettier/);
  assert.match(result.message, /no lo usa|no se usa|no la usa/);
});

test('either spelling of the import counts as using it', () => {
  assert.equal(ok({ 'eslint.config.js': "import prettier from 'eslint-config-prettier/flat';\nexport default [prettier];\n" }).status, 'pass');
  assert.equal(ok({ 'eslint.config.js': "const c = require('eslint-config-prettier');\nmodule.exports = [c];\n" }).status, 'pass');
});

test('without an ESLint config that part is not judged here', () => {
  assert.equal(ok({ 'eslint.config.js': null }).status, 'pass');
});

test('the ESLint config is searched with its own declared folder', () => {
  const root = project({ 'eslint.config.js': 'export default [];\n', 'web/package.json': PKG, 'web/.prettierrc': '{"printWidth":150}' });
  const cwd = path.join(root, 'web');
  assert.equal(run({ cwd, root, locations: { eslint: root } }).status, 'fail');
  assert.equal(run({ cwd, root }).status, 'pass');
});

test('several problems are listed together under one failure', () => {
  const result = ok({ 'package.json': { name: 'app', scripts: {} }, '.prettierrc': { printWidth: 100 } });
  assert.equal(result.status, 'fail');
  assert.ok(result.evidence.details.length >= 3);
  assert.match(result.message, /problemas/);
});
