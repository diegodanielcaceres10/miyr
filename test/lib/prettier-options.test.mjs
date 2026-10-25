import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPrettierOptions } from '../../src/lib/prettier-options.mjs';
import { project } from '../../test-support/project.mjs';

const read = (name, content, pkg) => {
  const cwd = project({ [name]: content, ...(pkg ? { 'package.json': pkg } : {}) });
  return readPrettierOptions(cwd, name === 'package.json' ? 'package.json' : name);
};

test('reads .prettierrc written as JSON, with comments', () => {
  assert.deepEqual(read('.prettierrc', '{ // width\n "printWidth": 150, "useTabs": true }').options, { printWidth: 150, useTabs: true });
});

test('reads .prettierrc written as YAML', () => {
  const { options } = read('.prettierrc', '# style\nprintWidth: 150\ntabWidth: 4\nuseTabs: false\nendOfLine: "lf" # unix\nsingleQuote: true\noverrides:\n  - files: "*.md"\n    options:\n      printWidth: 80\n');
  assert.deepEqual(options, { printWidth: 150, tabWidth: 4, useTabs: false, endOfLine: 'lf' });
});

test('reads the .json, .json5, .yaml, .yml and .toml variants', () => {
  assert.equal(read('.prettierrc.json', '{"printWidth": 120}').options.printWidth, 120);
  assert.equal(read('.prettierrc.json5', '{"printWidth": 120,}').options.printWidth, 120);
  assert.equal(read('.prettierrc.yaml', 'printWidth: 120\n').options.printWidth, 120);
  assert.equal(read('.prettierrc.yml', 'printWidth: 120\n').options.printWidth, 120);
  assert.deepEqual(read('.prettierrc.toml', 'printWidth = 120\nuseTabs = true\n[[overrides]]\nfiles = "*.md"\nprintWidth = 80\n').options, { printWidth: 120, useTabs: true });
});

test('reads the "prettier" key of package.json when it is an object', () => {
  assert.deepEqual(read('package.json', { name: 'x', prettier: { printWidth: 150, tabWidth: 2 } }).options, { printWidth: 150, tabWidth: 2 });
});

test('a shared config named in package.json, or a file of code, cannot be read', () => {
  assert.match(read('package.json', { name: 'x', prettier: '@company/prettier-config' }).unreadable, /compartid/);
  for (const name of ['prettier.config.js', 'prettier.config.mjs', '.prettierrc.cjs', '.prettierrc.ts']) {
    assert.match(read(name, 'export default {};').unreadable, /código/, name);
  }
});

test('content that is neither JSON nor simple YAML cannot be read', () => {
  assert.ok(read('.prettierrc', '{ not: [valid').unreadable);
});
