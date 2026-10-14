import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../../src/audits/typing/typescript-strict.mjs';

// Creates a throwaway project directory from a { filename: content } map.
function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'miyr-'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}

test('fails when tsconfig.json is missing', () => {
  const result = run({ cwd: project({}) });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /tsconfig\.json/);
});

test('errors when tsconfig.json is not valid JSONC', () => {
  const result = run({ cwd: project({ 'tsconfig.json': '{ "compilerOptions": }' }) });
  assert.equal(result.status, 'error');
});

test('fails when strict is not set', () => {
  const result = run({ cwd: project({ 'tsconfig.json': { compilerOptions: { target: 'ES2022' } } }) });
  assert.equal(result.status, 'fail');
  assert.equal(result.severity, 'high');
});

test('fails when strict is explicitly false', () => {
  const result = run({ cwd: project({ 'tsconfig.json': { compilerOptions: { strict: false } } }) });
  assert.equal(result.status, 'fail');
});

test('passes with strict true', () => {
  const result = run({ cwd: project({ 'tsconfig.json': { compilerOptions: { strict: true } } }) });
  assert.equal(result.status, 'pass');
  assert.equal(result.evidence.strict.file, 'tsconfig.json');
});

test('passes with strict inherited through extends and reports the source file', () => {
  const cwd = project({
    'tsconfig.base.json': { compilerOptions: { strict: true } },
    'tsconfig.json': '{\n // root config\n "extends": "./tsconfig.base.json",\n "compilerOptions": { "outDir": "dist", },\n}',
  });
  const result = run({ cwd });
  assert.equal(result.status, 'pass');
  assert.equal(result.evidence.strict.file, 'tsconfig.base.json');
});

test('fails when the leaf config overrides an inherited strict true', () => {
  const cwd = project({
    'tsconfig.base.json': { compilerOptions: { strict: true } },
    'tsconfig.json': { extends: './tsconfig.base.json', compilerOptions: { strict: false } },
  });
  assert.equal(run({ cwd }).status, 'fail');
});

test('fails when strict is true but individual flags are weakened', () => {
  const cwd = project({
    'tsconfig.json': { compilerOptions: { strict: true, noImplicitAny: false, strictNullChecks: false } },
  });
  const result = run({ cwd });
  assert.equal(result.status, 'fail');
  assert.equal(result.severity, 'medium');
  assert.match(result.message, /noImplicitAny/);
  assert.match(result.message, /strictNullChecks/);
  assert.equal(result.evidence.weakened.length, 2);
});

test('does not flag flags that are explicitly kept enabled', () => {
  const cwd = project({ 'tsconfig.json': { compilerOptions: { strict: true, noImplicitAny: true } } });
  assert.equal(run({ cwd }).status, 'pass');
});
