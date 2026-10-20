import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { KINDS, ancestors, baseFor, declareHint, findUp, whereSearched } from '../../src/lib/context.mjs';
import { project } from '../../test-support/project.mjs';

test('lists the kinds of file whose location can be declared', () => {
  assert.deepEqual(KINDS, ['ci', 'license', 'readme', 'editorconfig', 'gitignore', 'node-version']);
});

test('the base folder of a kind is the project folder unless a location is declared', () => {
  const ctx = { cwd: '/work/nura/web', locations: { license: '/work/nura' } };
  assert.equal(baseFor(ctx, 'license'), path.resolve('/work/nura'));
  assert.equal(baseFor(ctx, 'readme'), path.resolve('/work/nura/web'));
  assert.equal(baseFor({ cwd: '/work/nura/web' }, 'license'), path.resolve('/work/nura/web'));
});

test('ancestors lists directories from the project up to the base, nearest first', () => {
  const root = project({ 'apps/web/file.txt': '' });
  const cwd = path.join(root, 'apps', 'web');
  assert.deepEqual(ancestors(cwd, root), [cwd, path.join(root, 'apps'), root]);
});

test('ancestors is just the project when the base is the project itself', () => {
  const root = project({});
  assert.deepEqual(ancestors(root, root), [root]);
  assert.deepEqual(ancestors(root), [root]);
});

test('ancestors ignores a base that is not above the project', () => {
  const a = project({});
  const b = project({});
  assert.deepEqual(ancestors(a, b), [a]);
});

test('findUp only looks in the project folder when no location is declared', () => {
  const root = project({ LICENSE: 'root', 'web/package.json': '{}' });
  assert.equal(findUp({ cwd: path.join(root, 'web') }, 'license', ['LICENSE']), null);
});

test('findUp climbs to the declared base and returns the nearest match', () => {
  const root = project({ LICENSE: 'root', 'web/LICENSE': 'web', 'web/src/index.ts': '' });
  const web = path.join(root, 'web');
  const ctx = { cwd: web, locations: { license: root } };
  assert.equal(findUp(ctx, 'license', ['LICENSE']), path.join(web, 'LICENSE'));
  const bare = project({ LICENSE: 'root', 'web/package.json': '{}' });
  assert.equal(findUp({ cwd: path.join(bare, 'web'), locations: { license: bare } }, 'license', ['LICENSE']), path.join(bare, 'LICENSE'));
});

test('findUp never looks above the declared base', () => {
  const outer = project({ 'README.md': 'outside', 'repo/web/package.json': '{}' });
  const repo = path.join(outer, 'repo');
  assert.equal(findUp({ cwd: path.join(repo, 'web'), locations: { readme: repo } }, 'readme', ['README.md']), null);
});

test('each kind has its own base', () => {
  const root = project({ LICENSE: 'root', 'README.md': 'root', 'web/package.json': '{}' });
  const ctx = { cwd: path.join(root, 'web'), locations: { license: root } };
  assert.ok(findUp(ctx, 'license', ['LICENSE']));
  assert.equal(findUp(ctx, 'readme', ['README.md']), null);
});

test('findUp ignores case', () => {
  const dir = project({ 'readme.md': 'x' });
  assert.equal(findUp({ cwd: dir }, 'readme', ['README.md']), path.join(dir, 'readme.md'));
});

test('whereSearched says the project folder, or how far up the search went', () => {
  assert.equal(whereSearched({ cwd: '/w/nura/web' }, 'license'), 'en la carpeta del proyecto');
  const ctx = { cwd: '/w/nura/web', root: '/w/nura', locations: { license: '/w/nura' } };
  assert.equal(whereSearched(ctx, 'license'), 'en la carpeta del proyecto ni en las superiores hasta .');
  const deeper = { cwd: '/w/nura/apps/web', root: '/w/nura', locations: { license: '/w/nura/apps' } };
  assert.equal(whereSearched(deeper, 'license'), `en la carpeta del proyecto ni en las superiores hasta ${path.join('apps')}`);
});

test('declareHint tells where to declare a location for that kind', () => {
  const hint = declareHint('license');
  assert.match(hint, /shared\.license/);
  assert.match(hint, /locations\.license/);
});
