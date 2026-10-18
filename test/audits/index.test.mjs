import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profiles, runAudit } from '../../src/audits/index.mjs';
import { completeProject, project } from '../../test-support/project.mjs';

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
  const failing = results.filter((r) => r.status !== 'pass').map((r) => `${r.id}: ${r.message}`);
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
