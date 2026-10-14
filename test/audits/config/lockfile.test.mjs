import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../../src/audits/config/lockfile.mjs';
import { project } from '../../../test-support/project.mjs';

test('fails when there is no lockfile', () => {
  const result = run({ cwd: project({ 'package.json': {} }) });
  assert.equal(result.status, 'fail');
});

test('passes with a single lockfile', () => {
  assert.equal(run({ cwd: project({ 'package.json': {}, 'package-lock.json': '{}' }) }).status, 'pass');
});

test('fails when lockfiles of different managers coexist', () => {
  const cwd = project({ 'package.json': {}, 'package-lock.json': '{}', 'yarn.lock': '' });
  const result = run({ cwd });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /package-lock\.json/);
  assert.match(result.message, /yarn\.lock/);
});

test('fails when the lockfile is ignored by .gitignore', () => {
  const cwd = project({ 'package.json': {}, 'package-lock.json': '{}', '.gitignore': 'node_modules\npackage-lock.json\n' });
  const result = run({ cwd });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /\.gitignore/);
});

test('detects a lockfile ignored through a glob', () => {
  const cwd = project({ 'package.json': {}, 'yarn.lock': '', '.gitignore': '*.lock\n' });
  assert.equal(run({ cwd }).status, 'fail');
});

test('fails when the lockfile does not match packageManager', () => {
  const cwd = project({ 'package.json': { packageManager: 'pnpm@9.0.0' }, 'package-lock.json': '{}' });
  const result = run({ cwd });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /pnpm/);
});

test('passes when the lockfile matches packageManager', () => {
  const cwd = project({ 'package.json': { packageManager: 'yarn@4.5.0' }, 'yarn.lock': '' });
  assert.equal(run({ cwd }).status, 'pass');
});
