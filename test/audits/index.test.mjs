import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, SEVERITY, latestPackagesFor, profiles, runAudit, sortByLevel } from '../../src/audits/index.mjs';
import { completeProject, lockfile, project } from '../../test-support/project.mjs';

const ids = (profile) => profiles[profile].map((check) => check.id);

test('exposes the core, node and angular profiles', () => {
  assert.deepEqual(Object.keys(profiles).sort(), ['angular', 'core', 'node']);
});

test('each profile extends the previous one', () => {
  for (const id of ids('core')) assert.ok(ids('node').includes(id), id);
  for (const id of ids('node')) assert.ok(ids('angular').includes(id), id);
  assert.ok(ids('angular').length > ids('node').length);
  assert.ok(ids('node').length > ids('core').length);
});

test('the core profile only has stack-agnostic checks', () => {
  assert.deepEqual(ids('core').sort(), ['config/editorconfig', 'docs/license', 'docs/readme']);
});

test('the node profile has no Angular-specific checks', () => {
  assert.ok(!ids('node').includes('typing/typescript-strict'));
  assert.ok(ids('angular').includes('typing/typescript-strict'));
});

test('every check id is prefixed with its area and unique within a profile', () => {
  const areas = ['config', 'typing', 'ci', 'docs'];
  for (const name of Object.keys(profiles)) {
    assert.equal(new Set(ids(name)).size, ids(name).length, name);
    assert.ok(ids(name).every((id) => areas.includes(id.split('/')[0])), name);
  }
});

test('every check declares a title, a profile and a run function', () => {
  for (const check of profiles.angular) {
    assert.equal(typeof check.title, 'string', check.id);
    assert.ok(['core', 'node', 'angular'].includes(check.profile), check.id);
    assert.equal(typeof check.run, 'function', check.id);
  }
});

test('runAudit returns one passing result per check on a complete project', () => {
  const results = runAudit('angular', { cwd: completeProject() });
  assert.deepEqual(results.map((r) => r.id), ids('angular'));
  const failing = results.filter((r) => r.status !== 'pass' && r.status !== 'skip').map((r) => `${r.id}: ${r.message}`);
  assert.deepEqual(failing, []);
});

test('runAudit throws on an unknown profile', () => {
  assert.throws(() => runAudit('cobol', { cwd: '.' }), /cobol/);
});

test('node and angular projects without package.json report one failure instead of a cascade', () => {
  const cwd = project({});
  for (const name of ['node', 'angular']) {
    const results = runAudit(name, { cwd });
    assert.equal(results.length, 1, name);
    assert.equal(results[0].id, 'config/project');
    assert.equal(results[0].status, 'fail');
    assert.ok(results[0].message.includes('package.json'));
    assert.ok(results[0].message.includes(cwd), 'the message names the folder');
    assert.match(results[0].fix, /\.miyr\.json/);
  }
});

test('core projects do not need a package.json', () => {
  const results = runAudit('core', { cwd: project({}) });
  assert.equal(results.length, profiles.core.length);
});

test('the package.json precheck does not stop projects that have one', () => {
  const results = runAudit('node', { cwd: project({ 'package.json': {} }) });
  assert.equal(results.length, profiles.node.length);
});

const levelOf = (id) => profiles.angular.find((check) => check.id === id).level;

test('every check declares one of the levels A to D', () => {
  assert.deepEqual(LEVELS, ['A', 'B', 'C', 'D']);
  for (const check of profiles.angular) assert.ok(LEVELS.includes(check.level), check.id);
});

test('severity is derived from the level: A critical, B high, C medium, D low', () => {
  assert.deepEqual(SEVERITY, { A: 'critical', B: 'high', C: 'medium', D: 'low' });
});

test('every result carries the severity of its check level, whether it passes or not', () => {
  const cwd = completeProject({ 'package-lock.json': null, '.editorconfig': null });
  const results = runAudit('angular', { cwd });
  assert.ok(results.some((r) => r.status === 'fail') && results.some((r) => r.status === 'pass'));
  for (const result of results) assert.equal(result.severity, SEVERITY[levelOf(result.id)], result.id);
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  assert.equal(byId['config/lockfile'].severity, 'critical');
  assert.equal(byId['config/editorconfig'].severity, 'low');
});

test('checks are listed from the most to the least important level', () => {
  for (const name of Object.keys(profiles)) {
    const order = profiles[name].map((check) => LEVELS.indexOf(check.level));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), name);
  }
});

test('the configuration checks follow the agreed order of importance', () => {
  const config = (name) => profiles[name].map((check) => check.id).filter((id) => id.startsWith('config/'));
  assert.deepEqual(config('angular'), [
    'config/lockfile',
    'config/node-version',
    'config/dependencies',
    'config/angular-version',
    'config/package-scripts',
    'config/eslint',
    'config/prettier',
    'config/angular-defaults',
    'config/gitignore',
    'config/package-metadata',
    'config/editorconfig',
  ]);
  assert.deepEqual(config('node'), config('angular').filter((id) => !['config/angular-version', 'config/angular-defaults'].includes(id)));
  assert.deepEqual(config('core'), ['config/editorconfig']);
});

test('the missing package.json failure is critical', () => {
  const [result] = runAudit('node', { cwd: project({}) });
  assert.equal(result.severity, 'critical');
});

test('sortByLevel orders by level, keeps the given order inside a level and does not touch its input', () => {
  const given = [{ id: 'd1', level: 'D' }, { id: 'a1', level: 'A' }, { id: 'b1', level: 'B' }, { id: 'a2', level: 'A' }];
  assert.deepEqual(sortByLevel(given).map((c) => c.id), ['a1', 'a2', 'b1', 'd1']);
  assert.deepEqual(given.map((c) => c.id), ['d1', 'a1', 'b1', 'a2']);
});

test('a result may carry its own severity; otherwise it takes the one of its level', async () => {
  const cwd = completeProject({ 'package-lock.json': lockfile({ '@angular/core': '21.0.0', '@angular/router': '21.0.0' }) });
  const ctx = { cwd, online: true, latest: { '@angular/core': { version: '22.2.3' } } };
  const byId = Object.fromEntries(runAudit('angular', ctx).map((r) => [r.id, r]));
  assert.equal(byId['config/angular-version'].status, 'fail');
  assert.equal(byId['config/angular-version'].severity, 'medium');
  assert.equal(byId['config/lockfile'].severity, 'critical');
});

test('latestPackagesFor lists the packages whose latest version the profiles need', () => {
  assert.deepEqual(latestPackagesFor(['angular']), ['@angular/core']);
  assert.deepEqual(latestPackagesFor(['angular', 'angular']), ['@angular/core']);
  assert.deepEqual(latestPackagesFor(['node', 'core']), []);
  assert.deepEqual(latestPackagesFor([]), []);
});

test('the typing checks follow their levels: the strict ones first, the extra options after', () => {
  const typing = profiles.angular.map((check) => check.id).filter((id) => id.startsWith('typing/'));
  assert.deepEqual(typing, ['typing/typescript-strict', 'typing/tsconfig-inheritance', 'typing/angular-compiler', 'typing/typescript-extras']);
  assert.equal(levelOf('typing/typescript-extras'), 'C');
  assert.equal(levelOf('typing/angular-compiler'), 'B');
});

test('a node profile has no typing checks', () => {
  assert.deepEqual(profiles.node.filter((check) => check.id.startsWith('typing/')), []);
});

test('inside level C the Angular defaults come before the extra TypeScript options, then the docs', () => {
  const levelC = profiles.angular.filter((check) => check.level === 'C').map((check) => check.id);
  assert.deepEqual(levelC, ['config/eslint', 'config/prettier', 'config/angular-defaults', 'typing/typescript-extras', 'docs/readme', 'docs/license']);
});
