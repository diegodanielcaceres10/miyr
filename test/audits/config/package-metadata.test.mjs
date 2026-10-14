import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../../src/audits/config/package-metadata.mjs';
import { MIT, project } from '../../../test-support/project.mjs';

const PKG = { name: 'app', version: '1.2.3', private: true, license: 'MIT' };

test('fails when package.json is missing', () => {
  assert.equal(run({ cwd: project() }).status, 'fail');
});

test('passes with complete metadata and a matching LICENSE', () => {
  assert.equal(run({ cwd: project({ 'package.json': PKG, LICENSE: MIT }) }).status, 'pass');
});

test('lists the missing fields', () => {
  const result = run({ cwd: project({ 'package.json': {} }) });
  assert.equal(result.status, 'fail');
  for (const field of ['name', 'version', 'private', 'license']) assert.match(result.message, new RegExp(field));
});

test('fails on a version that is not semver', () => {
  const result = run({ cwd: project({ 'package.json': { ...PKG, version: '1.0' } }) });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /version/);
});

test('accepts prerelease versions', () => {
  assert.equal(run({ cwd: project({ 'package.json': { ...PKG, version: '2.0.0-beta.1' } }) }).status, 'pass');
});

test('does not require private for publishable packages', () => {
  const { private: _omit, ...publishable } = PKG;
  const cwd = project({ 'package.json': { ...publishable, main: 'index.js' } });
  assert.equal(run({ cwd }).status, 'pass');
});

test('fails when private is missing on an app', () => {
  const { private: _omit, ...app } = PKG;
  const result = run({ cwd: project({ 'package.json': app }) });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /private/);
});

test('fails when the license field contradicts the LICENSE file', () => {
  const apache = 'Apache License\n Version 2.0, January 2004\n';
  const result = run({ cwd: project({ 'package.json': PKG, LICENSE: apache }) });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /MIT/);
});

test('skips the content check for UNLICENSED, unknown identifiers or a missing LICENSE', () => {
  assert.equal(run({ cwd: project({ 'package.json': { ...PKG, license: 'UNLICENSED' }, LICENSE: MIT }) }).status, 'pass');
  assert.equal(run({ cwd: project({ 'package.json': { ...PKG, license: 'WTFPL' }, LICENSE: MIT }) }).status, 'pass');
  assert.equal(run({ cwd: project({ 'package.json': PKG }) }).status, 'pass');
});
