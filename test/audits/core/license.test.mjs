import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../../src/audits/core/license.mjs';
import { project } from '../../../test-support/project.mjs';

test('fails when no license file exists', () => {
  assert.equal(run({ cwd: project() }).status, 'fail');
});

test('fails when the license file is empty', () => {
  assert.equal(run({ cwd: project({ LICENSE: '  \n' }) }).status, 'fail');
});

for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license']) {
  test(`passes with a ${name} file`, () => {
    const result = run({ cwd: project({ [name]: 'MIT License\n' }) });
    assert.equal(result.status, 'pass');
  });
}
