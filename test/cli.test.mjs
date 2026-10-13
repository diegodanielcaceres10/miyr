import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const bin = path.resolve('bin/miyr.mjs');
const cli = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });

function project(tsconfig) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'miyr-cli-'));
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify(tsconfig));
  return dir;
}

test('exits 0 when all checks pass', () => {
  const result = cli('audit', 'angular', '--cwd', project({ compilerOptions: { strict: true } }));
  assert.equal(result.status, 0);
});

test('exits 1 when a check fails', () => {
  const result = cli('audit', 'angular', '--cwd', project({ compilerOptions: {} }));
  assert.equal(result.status, 1);
});

test('exits 2 on unknown usage', () => {
  assert.equal(cli('audit', 'unknown').status, 2);
});

test('--json prints machine-readable output', () => {
  const result = cli('audit', 'angular', '--json', '--cwd', project({ compilerOptions: { strict: true } }));
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.results[0].id, 'angular/typescript-strict');
  assert.equal(parsed.results[0].status, 'pass');
});
