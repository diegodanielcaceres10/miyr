import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
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

test('audit angular exits 1 when a core check fails', () => {
  assert.equal(cli('audit', 'angular', '--cwd', completeProject({ LICENSE: null })).status, 1);
});

test('audit core exits 0 without a tsconfig', () => {
  assert.equal(cli('audit', 'core', '--cwd', completeProject({ 'tsconfig.json': null })).status, 0);
});

test('audit core exits 1 on an empty project', () => {
  assert.equal(cli('audit', 'core', '--cwd', project()).status, 1);
});

test('exits 2 on an unknown profile and lists the available ones', () => {
  const result = cli('audit', 'unknown');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /angular/);
  assert.match(result.stderr, /core/);
});

test('exits 2 when the command is missing', () => {
  assert.equal(cli().status, 2);
});

test('--json prints machine-readable output with core and Angular results', () => {
  const result = cli('audit', 'angular', '--json', '--cwd', completeProject());
  const { results } = JSON.parse(result.stdout);
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  assert.equal(byId['angular/typescript-strict'].status, 'pass');
  assert.equal(byId['core/package-scripts'].status, 'pass');
  assert.equal(results.length, 6);
});
