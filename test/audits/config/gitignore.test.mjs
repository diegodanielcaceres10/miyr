import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../../src/audits/config/gitignore.mjs';
import { project } from '../../../test-support/project.mjs';

test('fails when .gitignore is missing', () => {
  assert.equal(run({ cwd: project() }).status, 'fail');
});

test('fails when node_modules is not ignored', () => {
  const result = run({ cwd: project({ '.gitignore': 'dist\n' }) });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /node_modules/);
});

test('passes with the usual spellings of node_modules', () => {
  for (const line of ['node_modules', '/node_modules/', '**/node_modules']) {
    assert.equal(run({ cwd: project({ '.gitignore': `${line}\n` }) }).status, 'pass', line);
  }
});

test('fails when node_modules is re-included by a negation', () => {
  assert.equal(run({ cwd: project({ '.gitignore': 'node_modules\n!node_modules\n' }) }).status, 'fail');
});
