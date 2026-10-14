import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../../src/audits/config/node-version.mjs';
import { project } from '../../../test-support/project.mjs';

const PKG = { engines: { node: '>=20' }, packageManager: 'npm@10.9.0' };
const ok = { 'package.json': PKG, '.nvmrc': '22\n' };

test('fails when package.json is missing', () => {
  assert.equal(run({ cwd: project() }).status, 'fail');
});

test('passes with engines, a version file and packageManager', () => {
  assert.equal(run({ cwd: project(ok) }).status, 'pass');
});

test('accepts .node-version instead of .nvmrc', () => {
  assert.equal(run({ cwd: project({ 'package.json': PKG, '.node-version': '22.11.0\n' }) }).status, 'pass');
});

test('lists everything that is missing', () => {
  const result = run({ cwd: project({ 'package.json': {} }) });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /engines\.node/);
  assert.match(result.message, /\.nvmrc/);
  assert.match(result.message, /packageManager/);
});

test('fails when only the version file is missing', () => {
  const result = run({ cwd: project({ 'package.json': PKG }) });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /\.nvmrc/);
  assert.doesNotMatch(result.message, /engines|packageManager/);
});

test('fails when the version file is empty', () => {
  assert.equal(run({ cwd: project({ ...ok, '.nvmrc': ' \n' }) }).status, 'fail');
});

test('fails when packageManager has no version', () => {
  const result = run({ cwd: project({ ...ok, 'package.json': { ...PKG, packageManager: 'pnpm' } }) });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /packageManager/);
});
