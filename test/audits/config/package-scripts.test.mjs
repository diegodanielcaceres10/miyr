import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../../src/audits/config/package-scripts.mjs';
import { project } from '../../../test-support/project.mjs';

const ALL = { start: 'ng serve', build: 'ng build', test: 'ng test', lint: 'ng lint' };

test('fails when package.json is missing', () => {
  assert.equal(run({ cwd: project() }).status, 'fail');
});

test('errors when package.json is not valid JSON', () => {
  assert.equal(run({ cwd: project({ 'package.json': '{ "scripts": }' }) }).status, 'error');
});

test('fails and lists the missing required scripts', () => {
  const result = run({ cwd: project({ 'package.json': { scripts: { start: 'x', build: 'x' } } }) });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /test/);
  assert.match(result.message, /lint/);
  assert.doesNotMatch(result.message, /start|build/);
});

test('fails when package.json has no scripts section', () => {
  assert.equal(run({ cwd: project({ 'package.json': { name: 'x' } }) }).status, 'fail');
});

test('fails when a required script is empty', () => {
  const result = run({ cwd: project({ 'package.json': { scripts: { ...ALL, lint: '  ' } } }) });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /lint/);
});

test('passes with the four required scripts and ignores extra ones', () => {
  const result = run({ cwd: project({ 'package.json': { scripts: { ...ALL, format: 'prettier .' } } }) });
  assert.equal(result.status, 'pass');
});

test('accepts a package.json saved with a UTF-8 BOM', () => {
  const result = run({ cwd: project({ 'package.json': `\uFEFF${JSON.stringify({ scripts: ALL })}` }) });
  assert.equal(result.status, 'pass');
});
