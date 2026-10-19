import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lockedVersions } from '../../src/lib/lockfile-versions.mjs';
import { project } from '../../test-support/project.mjs';

const NAMES = ['@angular/core', '@angular/router', 'rxjs'];

test('reads the resolved versions of a v3 lockfile', () => {
  const cwd = project({
    'package-lock.json': {
      lockfileVersion: 3,
      packages: {
        '': {},
        'node_modules/@angular/core': { version: '19.2.4' },
        'node_modules/@angular/router': { version: '19.2.3' },
      },
    },
  });
  assert.deepEqual(lockedVersions(cwd, NAMES), {
    file: 'package-lock.json',
    versions: { '@angular/core': '19.2.4', '@angular/router': '19.2.3' },
  });
});

test('reads a v1 lockfile, which keeps versions under "dependencies"', () => {
  const cwd = project({ 'package-lock.json': { lockfileVersion: 1, dependencies: { '@angular/core': { version: '12.2.17' } } } });
  assert.deepEqual(lockedVersions(cwd, NAMES).versions, { '@angular/core': '12.2.17' });
});

test('ignores copies nested inside other packages', () => {
  const cwd = project({
    'package-lock.json': { lockfileVersion: 3, packages: { 'node_modules/foo/node_modules/@angular/core': { version: '1.0.0' } } },
  });
  assert.deepEqual(lockedVersions(cwd, NAMES).versions, {});
});

test('only returns the requested packages', () => {
  const cwd = project({ 'package-lock.json': { lockfileVersion: 3, packages: { 'node_modules/rxjs': { version: '7.8.1' }, 'node_modules/zone.js': { version: '0.15.0' } } } });
  assert.deepEqual(lockedVersions(cwd, NAMES).versions, { rxjs: '7.8.1' });
});

test('returns null when there is no lockfile or it cannot be read', () => {
  assert.equal(lockedVersions(project({}), NAMES), null);
  assert.equal(lockedVersions(project({ 'package-lock.json': '{ not json' }), NAMES), null);
});
