import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIgnored } from '../../src/lib/gitignore.mjs';

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
