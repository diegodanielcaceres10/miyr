import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { profiles } from '../src/audits/index.mjs';
import { completeProject, project } from '../test-support/project.mjs';

const bin = path.resolve('bin/miyr.mjs');
const cli = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });

test('audit angular exits 0 when every check passes', () => {
  assert.equal(cli('audit', 'angular', '--cwd', completeProject()).status, 0);
});

test('audit angular exits 1 when an Angular check fails', () => {
  const cwd = completeProject({ 'tsconfig.json': { compilerOptions: {} } });
  assert.equal(cli('audit', 'angular', '--cwd', cwd).status, 1);
});

test('audit angular exits 1 when a node check fails', () => {
  assert.equal(cli('audit', 'angular', '--cwd', completeProject({ 'package-lock.json': null })).status, 1);
});

test('audit node exits 0 without a tsconfig', () => {
  assert.equal(cli('audit', 'node', '--cwd', completeProject({ 'tsconfig.json': null })).status, 0);
});

test('audit core only needs the stack-agnostic files', () => {
  const cwd = completeProject({ 'package.json': null, 'package-lock.json': null, '.nvmrc': null, '.gitignore': null, 'tsconfig.json': null });
  assert.equal(cli('audit', 'core', '--cwd', cwd).status, 0);
});

test('audit core exits 1 on an empty project', () => {
  assert.equal(cli('audit', 'core', '--cwd', project()).status, 1);
});

test('exits 2 on an unknown profile and lists the available ones', () => {
  const result = cli('audit', 'unknown');
  assert.equal(result.status, 2);
  for (const name of ['core', 'node', 'angular']) assert.match(result.stderr, new RegExp(name));
});

test('exits 2 when the command is missing', () => {
  assert.equal(cli().status, 2);
});

test('--json prints machine-readable results for every check of the profile', () => {
  const result = cli('audit', 'angular', '--json', '--cwd', completeProject());
  const { results } = JSON.parse(result.stdout);
  assert.equal(results.length, profiles.angular.length);
  assert.ok(results.every((r) => r.status === 'pass'));
  assert.ok(results.some((r) => r.id === 'typing/typescript-strict'));
});
