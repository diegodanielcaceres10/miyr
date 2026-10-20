import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as ciWorkflow from '../../src/audits/ci/workflow.mjs';
import * as editorconfig from '../../src/audits/config/editorconfig.mjs';
import * as gitignore from '../../src/audits/config/gitignore.mjs';
import * as lockfile from '../../src/audits/config/lockfile.mjs';
import * as nodeVersion from '../../src/audits/config/node-version.mjs';
import * as packageMetadata from '../../src/audits/config/package-metadata.mjs';
import * as license from '../../src/audits/docs/license.mjs';
import * as readme from '../../src/audits/docs/readme.mjs';
import { runAudit } from '../../src/audits/index.mjs';
import { WORKFLOW, completeRepo, project } from '../../test-support/project.mjs';

// The project lives in web/; the repository keeps its shared files at the root.
const rooted = (root, folders) => Object.fromEntries(Object.entries(folders).map(([kind, folder]) => [kind, path.resolve(root, folder)]));
const ALL = { ci: '.', license: '.', readme: '.', editorconfig: '.', gitignore: '.' };
const at = (overrides = {}, folders = {}) => {
  const root = completeRepo(overrides);
  return { cwd: path.join(root, 'web'), root, locations: rooted(root, folders) };
};
const CHECKS = { ci: ciWorkflow, license, readme, editorconfig, gitignore };

test('by default nothing outside the project folder is found', () => {
  const ctx = at();
  for (const [kind, check] of Object.entries(CHECKS)) assert.equal(check.run(ctx).status, 'fail', kind);
});

test('declaring a location makes each check look up to that folder', () => {
  const ctx = at({}, ALL);
  for (const [kind, check] of Object.entries(CHECKS)) assert.equal(check.run(ctx).status, 'pass', kind);
});

test('a project with every location declared passes the whole angular profile', () => {
  const failing = runAudit('angular', at({}, ALL)).filter((r) => r.status !== 'pass' && r.status !== 'skip');
  assert.deepEqual(failing.map((r) => `${r.id}: ${r.message}`), []);
});

test('locations are per kind', () => {
  const ctx = at({}, { license: '.' });
  assert.equal(license.run(ctx).status, 'pass');
  assert.equal(readme.run(ctx).status, 'fail');
});

test('declaring one kind affects only the check of that kind', () => {
  for (const kind of Object.keys(CHECKS)) {
    const ctx = at({}, { [kind]: '.' });
    for (const [checked, check] of Object.entries(CHECKS)) {
      assert.equal(check.run(ctx).status, checked === kind ? 'pass' : 'fail', `declared ${kind}, checked ${checked}`);
    }
  }
});

test('the node-version file is only found through its own kind', () => {
  const overrides = { 'web/.nvmrc': null, '.nvmrc': '22\n' };
  assert.equal(nodeVersion.run(at(overrides, { ...ALL })).status, 'fail');
  assert.equal(nodeVersion.run(at(overrides, { 'node-version': '.' })).status, 'pass');
});

test('the nearest file wins, even when a location is declared', () => {
  const badEditorconfig = at({ 'web/.editorconfig': 'root = true\n[*]\nindent_style = space\n' }, ALL);
  assert.equal(editorconfig.run(badEditorconfig).status, 'fail');
  const badReadme = at({ 'web/README.md': '# Web\n\n## Development server\n' }, ALL);
  assert.equal(readme.run(badReadme).status, 'fail');
});

test('files above the declared folder are never read', () => {
  const full = 'root = true\n[*]\ncharset = utf-8\nend_of_line = lf\nindent_style = space\nindent_size = 2\ninsert_final_newline = true\n';
  const outer = project({ '.editorconfig': full, 'repo/web/package.json': '{}' });
  const repo = path.join(outer, 'repo');
  assert.equal(editorconfig.run({ cwd: path.join(repo, 'web'), root: repo, locations: { editorconfig: repo } }).status, 'fail');
});

test('node-version: a version file at a declared folder applies to the project', () => {
  const overrides = { 'web/.nvmrc': null, '.nvmrc': '22\n' };
  assert.equal(nodeVersion.run(at(overrides, { 'node-version': '.' })).status, 'pass');
  assert.equal(nodeVersion.run(at(overrides)).status, 'fail');
});

test('gitignore: root rules apply only when the root is declared, and not when anchored to it', () => {
  assert.equal(gitignore.run(at({ 'web/.gitignore': null }, ALL)).status, 'pass');
  assert.equal(gitignore.run(at({ 'web/.gitignore': null })).status, 'fail');
  assert.equal(gitignore.run(at({ '.gitignore': '/node_modules\n', 'web/.gitignore': null }, ALL)).status, 'fail');
  assert.equal(gitignore.run(at({ '.gitignore': null, 'web/.gitignore': 'node_modules\n' })).status, 'pass');
});

test('lockfile: a root .gitignore that ignores it only counts when the root is declared', () => {
  const overrides = { '.gitignore': 'node_modules\npackage-lock.json\n', 'web/.gitignore': null };
  assert.equal(lockfile.run(at(overrides)).status, 'pass');
  assert.equal(lockfile.run(at(overrides, { gitignore: '.' })).status, 'fail');
});

test('package-metadata: the license field is compared with a LICENSE only where it is declared', () => {
  const apache = 'Apache License\n Version 2.0, January 2004\n';
  assert.equal(packageMetadata.run(at({ LICENSE: apache })).status, 'pass');
  assert.equal(packageMetadata.run(at({ LICENSE: apache }, { license: '.' })).status, 'fail');
});

test('ci/workflow: only <base>/.github/workflows counts, the base being the project unless declared', () => {
  const nested = { '.github/workflows/ci.yml': null, 'web/.github/workflows/ci.yml': WORKFLOW };
  assert.equal(ciWorkflow.run(at(nested)).status, 'pass');
  assert.equal(ciWorkflow.run(at(nested, { ci: '.' })).status, 'fail');
  assert.equal(ciWorkflow.run(at({}, { ci: '.' })).status, 'pass');
  assert.equal(ciWorkflow.run(at({})).status, 'fail');
});

test('failures say where they looked and how to declare another folder', () => {
  const ctx = at();
  assert.match(license.run(ctx).message, /No se encontró un archivo LICENSE en la carpeta del proyecto/);
  assert.match(license.run(ctx).fix, /shared\.license/);
  assert.match(readme.run(ctx).fix, /locations\.readme/);
  assert.match(editorconfig.run(ctx).fix, /shared\.editorconfig/);
  assert.match(gitignore.run(ctx).message, /ningún \.gitignore en la carpeta del proyecto/);
  assert.match(gitignore.run(ctx).fix, /shared\.gitignore/);
  assert.match(ciWorkflow.run(ctx).fix, /shared\.ci/);
});

test('when a base is declared the message says how far up the search went', () => {
  const ctx = at({ LICENSE: null }, ALL);
  assert.match(license.run(ctx).message, /en la carpeta del proyecto ni en las superiores hasta \./);
});

test('node-version tells where to declare the version file only when it is the missing piece', () => {
  const missingFile = nodeVersion.run(at({ 'web/.nvmrc': null }));
  assert.match(missingFile.fix, /node-version/);
  const missingEngines = nodeVersion.run(at({ 'web/package.json': { name: 'app', packageManager: 'npm@10.9.0' } }));
  assert.doesNotMatch(missingEngines.fix, /locations/);
});
