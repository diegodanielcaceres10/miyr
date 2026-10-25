import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as check from '../../../src/audits/config/eslint.mjs';
import { lockfile, project } from '../../../test-support/project.mjs';

const { run } = check;
const PKG = {
  name: 'app',
  dependencies: { '@angular/core': '^22.0.0' },
  devDependencies: { eslint: '^9.20.0', 'angular-eslint': '^20.0.0', 'typescript-eslint': '^8.0.0' },
  scripts: { lint: 'ng lint' },
};
const ANGULAR_JSON = { projects: { app: { architect: { lint: { builder: '@angular-eslint/builder:lint' } } } } };
const NODE_PKG = { name: 'api', devDependencies: { eslint: '^9.0.0' }, scripts: { lint: 'eslint .' } };

// A project folder; null removes an entry.
function ws(overrides = {}) {
  const files = { 'package.json': PKG, 'eslint.config.js': 'export default [];\n', 'angular.json': ANGULAR_JSON, ...overrides };
  for (const [name, content] of Object.entries(files)) if (content === null) delete files[name];
  return project(files);
}
const ok = (overrides) => run({ cwd: ws(overrides) });

test('declares its place in the report', () => {
  assert.deepEqual([check.id, check.profile, check.level], ['config/eslint', 'node', 'C']);
});

test('fails when package.json is missing', () => {
  assert.equal(run({ cwd: project({}) }).status, 'fail');
});

test('passes with a flat config, eslint 9, the Angular plugins and a lint script', () => {
  assert.equal(ok().status, 'pass');
});

test('accepts every flat config file name', () => {
  for (const name of ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts', 'eslint.config.cts']) {
    assert.equal(ok({ 'eslint.config.js': null, [name]: 'export default [];' }).status, 'pass', name);
  }
});

test('the old config format is rejected and the message says to migrate', () => {
  for (const legacy of ['.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.yaml', '.eslintrc.yml']) {
    const result = ok({ 'eslint.config.js': null, [legacy]: '{}' });
    assert.equal(result.status, 'fail', legacy);
    assert.match(result.message, /formato antiguo/, legacy);
    assert.match(result.message, /eslint\.config/, legacy);
  }
  const inPackage = ok({ 'eslint.config.js': null, 'package.json': { ...PKG, eslintConfig: { root: true } } });
  assert.match(inPackage.message, /formato antiguo/);
  assert.match(inPackage.message, /eslintConfig/);
});

test('with no config at all the failure says where it looked and how to point elsewhere', () => {
  const result = ok({ 'eslint.config.js': null });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /No se encontró eslint\.config/);
  assert.match(result.message, /en la carpeta del proyecto/);
  assert.match(result.fix, /shared\.eslint/);
  assert.match(result.fix, /locations\.eslint/);
});

test('a config kept at a declared folder is found, and one above it is not', () => {
  const root = project({ 'eslint.config.js': 'export default [];', 'web/package.json': PKG, 'web/angular.json': ANGULAR_JSON });
  const cwd = path.join(root, 'web');
  assert.equal(run({ cwd, root, locations: { eslint: root } }).status, 'pass');
  assert.equal(run({ cwd, root }).status, 'fail');
});

test('eslint must be a dependency', () => {
  const result = ok({ 'package.json': { ...PKG, devDependencies: { 'angular-eslint': '^20.0.0', 'typescript-eslint': '^8.0.0' } } });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /eslint/);
  assert.equal(ok({ 'package.json': { ...PKG, dependencies: { ...PKG.dependencies, eslint: '^9.0.0' }, devDependencies: { 'angular-eslint': '^20.0.0', 'typescript-eslint': '^8.0.0' } } }).status, 'pass');
});

test('eslint must be version 9 or later, read from the lockfile or the declared range', () => {
  const locked = ok({ 'package-lock.json': lockfile({ eslint: '8.57.0' }) });
  assert.equal(locked.status, 'fail');
  assert.match(locked.message, /8\.57\.0/);
  assert.match(locked.message, /9/);
  const declared = ok({ 'package.json': { ...PKG, devDependencies: { ...PKG.devDependencies, eslint: '^8.0.0' } } });
  assert.equal(declared.status, 'fail');
  assert.equal(ok({ 'package-lock.json': lockfile({ eslint: '9.20.0' }) }).status, 'pass');
  assert.equal(ok({ 'package.json': { ...PKG, devDependencies: { ...PKG.devDependencies, eslint: 'latest' } } }).status, 'pass');
});

test('the lockfile wins over the declared range for the eslint version', () => {
  const result = ok({ 'package.json': { ...PKG, devDependencies: { ...PKG.devDependencies, eslint: '^9.0.0' } }, 'package-lock.json': lockfile({ eslint: '8.57.0' }) });
  assert.equal(result.status, 'fail');
});

test('an Angular project needs angular-eslint and typescript-eslint, a plain Node project does not', () => {
  const noPlugins = ok({ 'package.json': { ...PKG, devDependencies: { eslint: '^9.0.0' } } });
  assert.equal(noPlugins.status, 'fail');
  assert.match(noPlugins.message, /angular-eslint/);
  assert.match(noPlugins.message, /typescript-eslint/);
  assert.equal(ok({ 'package.json': NODE_PKG, 'angular.json': null }).status, 'pass');
});

test('the lint script must run eslint or ng lint', () => {
  for (const script of ['eslint .', 'npx eslint src', 'npm run eslint:check && echo']) {
    assert.equal(ok({ 'package.json': { ...NODE_PKG, scripts: { lint: script } }, 'angular.json': null }).status, 'pass', script);
  }
  for (const script of ['echo ok', '', 'prettier --check .']) {
    const result = ok({ 'package.json': { ...NODE_PKG, scripts: { lint: script } }, 'angular.json': null });
    assert.equal(result.status, 'fail', JSON.stringify(script));
    assert.match(result.message, /lint/);
  }
  assert.equal(ok({ 'package.json': { ...NODE_PKG, scripts: {} }, 'angular.json': null }).status, 'fail');
});

test('with ng lint, angular.json must have a lint target using the angular-eslint builder', () => {
  assert.equal(ok({ 'angular.json': { projects: { app: { architect: {} } } } }).status, 'fail');
  assert.equal(ok({ 'angular.json': { projects: { app: { architect: { lint: { builder: '@angular-devkit/build-angular:tslint' } } } } } }).status, 'fail');
  assert.equal(ok({ 'angular.json': { projects: { app: { targets: { lint: { builder: '@angular-eslint/builder:lint' } } } } } }).status, 'pass');
  assert.equal(ok({ 'angular.json': null }).status, 'fail');
  assert.equal(ok({ 'angular.json': '{ not json' }).status, 'fail');
});

test('with an eslint lint script on an Angular project no lint target is required', () => {
  const pkg = { ...PKG, scripts: { lint: 'eslint .' } };
  assert.equal(ok({ 'package.json': pkg, 'angular.json': null }).status, 'pass');
});

test('several problems are listed together under one failure', () => {
  const result = ok({ 'eslint.config.js': null, 'package.json': { name: 'app', dependencies: { '@angular/core': '^22.0.0' }, scripts: { lint: 'echo' } } });
  assert.equal(result.status, 'fail');
  assert.ok(result.evidence.details.length >= 3);
  assert.match(result.message, /problemas/);
});
