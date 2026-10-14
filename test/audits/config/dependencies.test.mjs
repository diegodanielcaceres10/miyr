import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../../src/audits/config/dependencies.mjs';
import { project } from '../../../test-support/project.mjs';

const check = (pkg) => run({ cwd: project({ 'package.json': pkg }) });

test('fails when package.json is missing', () => {
  assert.equal(run({ cwd: project() }).status, 'fail');
});

test('passes with pinned ranges and tooling in devDependencies', () => {
  const result = check({
    dependencies: { rxjs: '~7.8.0', express: '^4.19.0' },
    devDependencies: { eslint: '^9.0.0', prettier: '3.3.0', '@types/node': '^22.0.0' },
  });
  assert.equal(result.status, 'pass');
});

test('passes when there are no dependency sections', () => {
  assert.equal(check({}).status, 'pass');
});

test('fails on wildcard and latest ranges', () => {
  const result = check({ dependencies: { a: '*', b: 'latest' }, devDependencies: { c: 'x', d: '^1.0.0' } });
  assert.equal(result.status, 'fail');
  for (const name of ['a', 'b', 'c']) assert.match(result.message, new RegExp(`\\b${name}\\b`));
  assert.doesNotMatch(result.message, /\bd\b/);
});

test('fails when a package is in both dependencies and devDependencies', () => {
  const result = check({ dependencies: { lodash: '^4.0.0' }, devDependencies: { lodash: '^4.0.0' } });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /lodash/);
});

test('fails when tooling is listed under dependencies', () => {
  const result = check({ dependencies: { eslint: '^9.0.0', '@types/node': '^22.0.0', 'eslint-config-prettier': '^9.0.0', express: '^4.0.0' } });
  assert.equal(result.status, 'fail');
  for (const name of ['eslint', '@types/node', 'eslint-config-prettier']) assert.ok(result.message.includes(name), name);
  assert.ok(!result.message.includes('express'));
});

test('reports every kind of problem at once', () => {
  const result = check({ dependencies: { a: '*', eslint: '^9.0.0' }, devDependencies: { a: '*' } });
  assert.equal(result.status, 'fail');
  assert.equal(result.evidence.problems.length, 3);
});
