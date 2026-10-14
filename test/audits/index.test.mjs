import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profiles, runAudit } from '../../src/audits/index.mjs';
import { completeProject } from '../../test-support/project.mjs';

const ids = (profile) => profiles[profile].map((check) => check.id);

test('exposes the core and angular profiles', () => {
  assert.deepEqual(Object.keys(profiles).sort(), ['angular', 'core']);
});

test('the angular profile includes every core check plus its own', () => {
  for (const id of ids('core')) assert.ok(ids('angular').includes(id), id);
  assert.ok(ids('angular').includes('angular/typescript-strict'));
});

test('the core profile has no Angular-specific checks', () => {
  assert.ok(ids('core').every((id) => id.startsWith('core/')));
});

test('check ids are unique within a profile', () => {
  for (const name of Object.keys(profiles)) assert.equal(new Set(ids(name)).size, ids(name).length, name);
});

test('runAudit returns one result per check', () => {
  const results = runAudit('angular', { cwd: completeProject() });
  assert.deepEqual(results.map((r) => r.id), ids('angular'));
  assert.ok(results.every((r) => r.status === 'pass'));
});

test('runAudit throws on an unknown profile', () => {
  assert.throws(() => runAudit('cobol', { cwd: '.' }), /cobol/);
});
