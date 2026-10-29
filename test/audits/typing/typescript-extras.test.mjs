import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as check from '../../../src/audits/typing/typescript-extras.mjs';
import { project } from '../../../test-support/project.mjs';

const { run } = check;
const REQUIRED = { noImplicitOverride: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true };
const ALL = { ...REQUIRED, forceConsistentCasingInFileNames: true };
const audit = (files) => run({ cwd: project(files) });
const options = (compilerOptions) => ({ 'tsconfig.json': { compilerOptions } });

test('declares its place in the report', () => {
  assert.deepEqual([check.id, check.profile, check.level], ['typing/typescript-extras', 'angular', 'C']);
});

test('without a usable tsconfig.json it is skipped', () => {
  assert.equal(audit({}).status, 'skip');
  assert.equal(audit({ 'tsconfig.json': '{ nope' }).status, 'skip');
});

test('passes with the four options', () => {
  assert.equal(audit(options(ALL)).status, 'pass');
});

test('each of the three that default to false must be set to true', () => {
  for (const flag of Object.keys(REQUIRED)) {
    const { [flag]: _omit, ...rest } = ALL;
    const missing = audit(options(rest));
    assert.equal(missing.status, 'fail', flag);
    assert.match(missing.message, new RegExp(flag), flag);
    assert.match(missing.message, /debe ser true/, flag);
    const off = audit(options({ ...ALL, [flag]: false }));
    assert.equal(off.status, 'fail', flag);
    assert.match(off.message, new RegExp(`${flag}: false \\(tsconfig\\.json\\)`), flag);
  }
});

test('forceConsistentCasingInFileNames is true by default, so only false fails', () => {
  const { forceConsistentCasingInFileNames: _omit, ...unset } = ALL;
  assert.equal(audit(options(unset)).status, 'pass');
  const off = audit(options({ ...ALL, forceConsistentCasingInFileNames: false }));
  assert.equal(off.status, 'fail');
  assert.match(off.message, /forceConsistentCasingInFileNames/);
});

test('options inherited through extends count, and a leaf that turns one off is named', () => {
  assert.equal(audit({ 'tsconfig.base.json': { compilerOptions: ALL }, 'tsconfig.json': { extends: './tsconfig.base.json' } }).status, 'pass');
  const result = audit({
    'tsconfig.base.json': { compilerOptions: ALL },
    'tsconfig.json': { extends: './tsconfig.base.json', compilerOptions: { noImplicitReturns: false } },
  });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /noImplicitReturns: false \(tsconfig\.json\)/);
});

test('strict does not stand in for the extra options', () => {
  assert.equal(audit(options({ strict: true })).status, 'fail');
});

test('several problems are listed together', () => {
  const result = audit(options({ strict: true, forceConsistentCasingInFileNames: false }));
  assert.equal(result.status, 'fail');
  assert.equal(result.evidence.details.length, 4);
  assert.match(result.message, /4 problemas/);
});
