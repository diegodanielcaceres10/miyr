import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ignoreState, isIgnored, isIgnoredInRepo } from '../../src/lib/gitignore.mjs';
import { project } from '../../test-support/project.mjs';

test('matches an exact name', () => {
  assert.equal(isIgnored('node_modules\n', 'node_modules'), true);
});

test('matches with a leading slash, a trailing slash or a **/ prefix', () => {
  for (const pattern of ['/node_modules', 'node_modules/', '/node_modules/', '**/node_modules']) {
    assert.equal(isIgnored(pattern, 'node_modules'), true, pattern);
  }
});

test('matches simple globs', () => {
  assert.equal(isIgnored('*.lock\n', 'yarn.lock'), true);
  assert.equal(isIgnored('*.lock\n', 'package-lock.json'), false);
});

test('does not match different names', () => {
  assert.equal(isIgnored('node_modules\n', 'node_modules_backup'), false);
  assert.equal(isIgnored('dist\n', 'distro'), false);
});

test('ignores comments and blank lines', () => {
  assert.equal(isIgnored('# node_modules\n\n', 'node_modules'), false);
});

test('a later negation re-includes the path', () => {
  assert.equal(isIgnored('*.lock\n!yarn.lock\n', 'yarn.lock'), false);
});

test('handles CRLF line endings', () => {
  assert.equal(isIgnored('dist\r\nnode_modules\r\n', 'node_modules'), true);
});

test('unanchored patterns match at any depth', () => {
  assert.equal(isIgnored('node_modules\n', 'web/node_modules'), true);
  assert.equal(isIgnored('**/node_modules\n', 'apps/web/node_modules'), true);
});

test('patterns with a leading or inner slash only match from their own folder', () => {
  assert.equal(isIgnored('/node_modules\n', 'web/node_modules'), false);
  assert.equal(isIgnored('web/dist\n', 'web/dist'), true);
  assert.equal(isIgnored('web/dist\n', 'other/web/dist'), false);
});

test('a path below an ignored directory is ignored and cannot be re-included', () => {
  assert.equal(isIgnored('web\n', 'web/dist'), true);
  assert.equal(isIgnored('web\n!dist\n', 'web/dist'), true);
});

test('ignoreState is null when no rule matches', () => {
  assert.equal(ignoreState('dist\n', 'node_modules'), null);
  assert.equal(ignoreState('', 'node_modules'), null);
  assert.equal(ignoreState('*.lock\n!yarn.lock\n', 'yarn.lock'), false);
});

const ctxAt = (root, sub = 'web') => ({ cwd: path.join(root, sub), root });

test('isIgnoredInRepo reads the .gitignore of the repository root', () => {
  const root = project({ '.gitignore': 'node_modules\n', 'web/package.json': '{}' });
  assert.equal(isIgnoredInRepo(ctxAt(root), 'node_modules'), true);
});

test('isIgnoredInRepo ignores root rules anchored to the root', () => {
  const root = project({ '.gitignore': '/node_modules\n', 'web/package.json': '{}' });
  assert.equal(isIgnoredInRepo(ctxAt(root), 'node_modules'), false);
});

test('isIgnoredInRepo reads the .gitignore inside the project folder', () => {
  const root = project({ 'web/.gitignore': '/node_modules\n' });
  assert.equal(isIgnoredInRepo(ctxAt(root), 'node_modules'), true);
});

test('a deeper .gitignore overrides a parent one', () => {
  const root = project({ '.gitignore': 'node_modules\n', 'web/.gitignore': '!node_modules\n' });
  assert.equal(isIgnoredInRepo(ctxAt(root), 'node_modules'), false);
});

test('isIgnoredInRepo works without a root and with no .gitignore at all', () => {
  const dir = project({ '.gitignore': 'dist\n' });
  assert.equal(isIgnoredInRepo({ cwd: dir }, 'dist'), true);
  assert.equal(isIgnoredInRepo({ cwd: project({}) }, 'dist'), false);
});
