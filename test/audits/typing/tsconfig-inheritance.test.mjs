import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as check from '../../../src/audits/typing/tsconfig-inheritance.mjs';
import { project } from '../../../test-support/project.mjs';

const { run } = check;
const ROOT = { 'tsconfig.json': { compilerOptions: { strict: true } } };
const audit = (files) => run({ cwd: project({ ...ROOT, ...files }) });
const extending = (target) => ({ extends: target });

test('declares its place in the report', () => {
  assert.deepEqual([check.id, check.profile, check.level], ['typing/tsconfig-inheritance', 'angular', 'B']);
});

test('without a root tsconfig.json it is skipped', () => {
  assert.equal(run({ cwd: project({ 'tsconfig.app.json': extending('./tsconfig.json') }) }).status, 'skip');
});

test('a root tsconfig.json that cannot be read is skipped', () => {
  assert.equal(run({ cwd: project({ 'tsconfig.json': '{ nope' }) }).status, 'skip');
});

test('passes when there are no derived configs to check', () => {
  const result = audit({});
  assert.equal(result.status, 'pass');
  assert.match(result.message, /no hay/i);
});

test('passes when the app and spec configs extend the root one', () => {
  const result = audit({ 'tsconfig.app.json': extending('./tsconfig.json'), 'tsconfig.spec.json': extending('./tsconfig.json') });
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.evidence.checked.sort(), ['tsconfig.app.json', 'tsconfig.spec.json']);
});

test('extending the root one through another config counts', () => {
  const files = {
    'tsconfig.shared.json': extending('./tsconfig.json'),
    'tsconfig.app.json': extending('./tsconfig.shared.json'),
  };
  assert.equal(audit(files).status, 'pass');
});

test('extends may be a list that includes the root one', () => {
  assert.equal(audit({ 'tsconfig.base.json': {}, 'tsconfig.app.json': { extends: ['./tsconfig.base.json', './tsconfig.json'] } }).status, 'pass');
});

test('a config that extends something else, or nothing, fails and is named', () => {
  const result = audit({
    'tsconfig.other.json': {},
    'tsconfig.app.json': extending('./tsconfig.other.json'),
    'tsconfig.spec.json': extending('./tsconfig.json'),
    'tsconfig.lib.json': { compilerOptions: {} },
  });
  assert.equal(result.status, 'fail');
  assert.match(result.message + (result.evidence?.details ?? []).join(' '), /tsconfig\.app\.json/);
  assert.match(result.message + (result.evidence?.details ?? []).join(' '), /tsconfig\.lib\.json/);
  assert.doesNotMatch(result.message + (result.evidence?.details ?? []).join(' '), /tsconfig\.spec\.json/);
  assert.match(result.message + (result.evidence?.details ?? []).join(' '), /no extiende/);
});

test('a single failing config is described in the message itself', () => {
  const result = audit({ 'tsconfig.app.json': { compilerOptions: {} } });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /tsconfig\.app\.json no extiende tsconfig\.json/);
  assert.match(result.fix, /"extends": "\.\/tsconfig\.json"/);
});

test('tsconfig.base.json is not a derived config', () => {
  assert.equal(audit({ 'tsconfig.base.json': { compilerOptions: {} } }).status, 'pass');
});

test('configs that the root one itself extends are not asked to extend it', () => {
  const files = { 'tsconfig.json': { extends: './tsconfig.common.json' }, 'tsconfig.common.json': { compilerOptions: { strict: true } } };
  assert.equal(run({ cwd: project(files) }).status, 'pass');
});

test('only tsconfig.<name>.json files in the project folder are looked at', () => {
  const files = {
    'sub/tsconfig.app.json': { compilerOptions: {} },
    'tsconfig-extra.json': {},
    'tsconfig.app.json5': {},
    'tsconfig.app.txt': 'x',
  };
  assert.equal(audit(files).status, 'pass');
});

test('a derived config that cannot be read fails and is named', () => {
  const result = audit({ 'tsconfig.app.json': '{ nope' });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /tsconfig\.app\.json/);
  assert.match(result.message, /no se pudo leer/);
});

test('comments in a derived config do not matter', () => {
  assert.equal(audit({ 'tsconfig.app.json': '{\n // app\n "extends": "./tsconfig.json",\n}' }).status, 'pass');
});
