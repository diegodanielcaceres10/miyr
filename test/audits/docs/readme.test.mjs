import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../../src/audits/docs/readme.mjs';
import { README, project } from '../../../test-support/project.mjs';

test('fails when README is missing', () => {
  assert.equal(run({ cwd: project() }).status, 'fail');
});

test('fails when README is empty', () => {
  assert.equal(run({ cwd: project({ 'README.md': '  \n' }) }).status, 'fail');
});

test('passes with Spanish section headings', () => {
  assert.equal(run({ cwd: project({ 'README.md': README }) }).status, 'pass');
});

test('passes with English section headings', () => {
  const content = '# App\n\n## Installation\n\n## Usage\n\n## Build\n\n## Testing\n';
  assert.equal(run({ cwd: project({ 'README.md': content }) }).status, 'pass');
});

test('fails and lists the missing sections', () => {
  const result = run({ cwd: project({ 'README.md': '# App\n\n## Instalación\n\n## Build\n' }) });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /ejecución/);
  assert.match(result.message, /pruebas/);
  assert.doesNotMatch(result.message, /instalación|build/);
});

test('does not count headings written inside fenced code blocks', () => {
  const content = '# App\n\n```bash\n# install deps\n# run the app\n# build\n# test\n```\n';
  assert.equal(run({ cwd: project({ 'README.md': content }) }).status, 'fail');
});

test('finds the README regardless of file name case', () => {
  assert.equal(run({ cwd: project({ 'readme.md': README }) }).status, 'pass');
});
