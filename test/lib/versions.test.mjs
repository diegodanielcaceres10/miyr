import { test } from 'node:test';
import assert from 'node:assert/strict';
import { majorOf } from '../../src/lib/versions.mjs';

test('reads the major of exact versions and of ranges, by their lower bound', () => {
  assert.equal(majorOf('22.2.1'), 22);
  assert.equal(majorOf('^22.0.0'), 22);
  assert.equal(majorOf('~18.1.0'), 18);
  assert.equal(majorOf('19.x'), 19);
  assert.equal(majorOf('>=19 <21'), 19);
  assert.equal(majorOf('v20'), 20);
  assert.equal(majorOf('23.0.0-next.1'), 23);
  assert.equal(majorOf('  ^9.20.0 '), 9);
});

test('tags, wildcards, URLs and empty values have no major', () => {
  for (const value of ['latest', '*', 'next', 'workspace:*', 'file:../core', 'git+https://x/y.git', '', undefined]) {
    assert.equal(majorOf(value), null, String(value));
  }
});
