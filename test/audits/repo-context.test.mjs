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

// The project lives in web/; repository-level files live at the root.
const at = (overrides) => {
  const root = completeRepo(overrides);
  return { cwd: path.join(root, 'web'), root };
};

test('a repository with repo-level files at the root passes every angular check', () => {
  const results = runAudit('angular', at({}));
  assert.deepEqual(results.filter((r) => r.status !== 'pass' && r.status !== 'skip').map((r) => `${r.id}: ${r.message}`), []);
});

test('editorconfig: uses the root file and prefers the nearest one', () => {
  assert.equal(editorconfig.run(at({})).status, 'pass');
  assert.equal(editorconfig.run(at({ 'web/.editorconfig': 'root = true\n[*]\nindent_style = space\n' })).status, 'fail');
});

test('editorconfig: ignores files above the repository root', () => {
  const outer = project({ '.editorconfig': 'root = true\n[*]\ncharset = utf-8\nend_of_line = lf\nindent_style = space\nindent_size = 2\ninsert_final_newline = true\n', 'repo/web/package.json': '{}' });
  const root = path.join(outer, 'repo');
  assert.equal(editorconfig.run({ cwd: path.join(root, 'web'), root }).status, 'fail');
});

test('readme: uses the root README and prefers the nearest one', () => {
  assert.equal(readme.run(at({})).status, 'pass');
  assert.equal(readme.run(at({ 'web/README.md': '# Web\n\n## Development server\n' })).status, 'fail');
  assert.equal(readme.run(at({ 'README.md': null })).status, 'fail');
});

test('license: found at the repository root', () => {
  assert.equal(license.run(at({})).status, 'pass');
  assert.equal(license.run(at({ LICENSE: null })).status, 'fail');
});

test('node-version: a version file at the root applies to the project', () => {
  assert.equal(nodeVersion.run(at({ 'web/.nvmrc': null, '.nvmrc': '22\n' })).status, 'pass');
  assert.equal(nodeVersion.run(at({ 'web/.nvmrc': null })).status, 'fail');
});

test('gitignore: root rules apply to the project unless anchored to the root', () => {
  assert.equal(gitignore.run(at({})).status, 'pass');
  assert.equal(gitignore.run(at({ '.gitignore': '/node_modules\n' })).status, 'fail');
  assert.equal(gitignore.run(at({ '.gitignore': null, 'web/.gitignore': 'node_modules\n' })).status, 'pass');
});

test('gitignore: fails when no .gitignore exists anywhere in the chain', () => {
  const result = gitignore.run(at({ '.gitignore': null }));
  assert.equal(result.status, 'fail');
  assert.match(result.message, /ningún \.gitignore/);
});

test('lockfile: a root rule that ignores it applies, an anchored one does not', () => {
  assert.equal(lockfile.run(at({ '.gitignore': 'node_modules\npackage-lock.json\n' })).status, 'fail');
  assert.equal(lockfile.run(at({ '.gitignore': 'node_modules\n/package-lock.json\n' })).status, 'pass');
});

test('package-metadata: compares the license field with the LICENSE found up the tree', () => {
  const apache = 'Apache License\n Version 2.0, January 2004\n';
  assert.equal(packageMetadata.run(at({})).status, 'pass');
  assert.equal(packageMetadata.run(at({ LICENSE: apache })).status, 'fail');
});

test('ci/workflow: only the workflows at the repository root count', () => {
  assert.equal(ciWorkflow.run(at({})).status, 'pass');
  const nested = at({ '.github/workflows/ci.yml': null, 'web/.github/workflows/ci.yml': WORKFLOW });
  assert.equal(ciWorkflow.run(nested).status, 'fail');
});
