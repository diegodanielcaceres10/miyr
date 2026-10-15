import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ancestors, findRepoRoot, findUp, makeContext } from '../../src/lib/context.mjs';
import { project } from '../../test-support/project.mjs';

test('findRepoRoot returns the nearest ancestor that contains .git', () => {
  const root = project({ '.git/HEAD': 'x', 'a/b/file.txt': '' });
  assert.equal(findRepoRoot(path.join(root, 'a', 'b')), root);
});

test('findRepoRoot accepts .git as a file (worktrees, submodules)', () => {
  const root = project({ '.git': 'gitdir: ../elsewhere', 'a/file.txt': '' });
  assert.equal(findRepoRoot(path.join(root, 'a')), root);
});

test('findRepoRoot does not climb past the limit', () => {
  const outer = project({ '.git/HEAD': 'x', 'repo/a/file.txt': '' });
  const repo = path.join(outer, 'repo');
  assert.equal(findRepoRoot(path.join(repo, 'a'), { limit: repo }), null);
  assert.equal(findRepoRoot(path.join(repo, 'a')), outer);
});

test('makeContext pairs the project folder with its repository root', () => {
  const root = project({ '.git/HEAD': 'x', 'web/package.json': '{}' });
  assert.deepEqual(makeContext(path.join(root, 'web')), { cwd: path.join(root, 'web'), root });
});

test('ancestors lists directories from the project up to the root, nearest first', () => {
  const root = project({ 'apps/web/file.txt': '' });
  const cwd = path.join(root, 'apps', 'web');
  assert.deepEqual(ancestors({ cwd, root }), [cwd, path.join(root, 'apps'), root]);
});

test('ancestors is just the project when the root is the project or unknown', () => {
  const root = project({});
  assert.deepEqual(ancestors({ cwd: root, root }), [root]);
  assert.deepEqual(ancestors({ cwd: root }), [root]);
});

test('ancestors ignores a root that is not an ancestor of the project', () => {
  const a = project({});
  const b = project({});
  assert.deepEqual(ancestors({ cwd: a, root: b }), [a]);
});

test('findUp returns the nearest match', () => {
  const root = project({ 'LICENSE': 'root', 'web/LICENSE': 'web' });
  const found = findUp({ cwd: path.join(root, 'web'), root }, ['LICENSE']);
  assert.equal(found, path.join(root, 'web', 'LICENSE'));
});

test('findUp climbs to the root but never past it', () => {
  const outer = project({ 'README.md': 'outside', 'repo/web/package.json': '{}' });
  const root = path.join(outer, 'repo');
  const ctx = { cwd: path.join(root, 'web'), root };
  assert.equal(findUp(ctx, ['README.md']), null);
  const inside = project({ 'README.md': 'root', 'web/package.json': '{}' });
  assert.equal(findUp({ cwd: path.join(inside, 'web'), root: inside }, ['README.md']), path.join(inside, 'README.md'));
});

test('findUp ignores case and works without a root', () => {
  const dir = project({ 'readme.md': 'x' });
  assert.equal(findUp({ cwd: dir }, ['README.md']), path.join(dir, 'readme.md'));
});
