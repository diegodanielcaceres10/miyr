import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as check from '../../../src/audits/typing/angular-compiler.mjs';
import { project } from '../../../test-support/project.mjs';

const { run } = check;
const FLAGS = { strictInjectionParameters: true, strictInputAccessModifiers: true, strictTemplates: true };
const audit = (files) => run({ cwd: project(files) });
const text = (result) => result.evidence?.details?.join(' ') ?? result.message;

test('declares its place in the report', () => {
  assert.deepEqual([check.id, check.profile, check.level], ['typing/angular-compiler', 'angular', 'B']);
});

test('without a tsconfig.json there is nothing to judge, and typescript-strict is the one that fails', () => {
  const result = audit({});
  assert.equal(result.status, 'skip');
  assert.match(result.message, /typescript-strict/);
});

test('a tsconfig.json that cannot be read is skipped with the reason', () => {
  const result = audit({ 'tsconfig.json': '{ not json' });
  assert.equal(result.status, 'skip');
  assert.match(result.message, /tsconfig\.json/);
});

test('passes with the three flags set to true', () => {
  assert.equal(audit({ 'tsconfig.json': { angularCompilerOptions: FLAGS } }).status, 'pass');
});

test('fails naming each flag that is missing', () => {
  for (const flag of Object.keys(FLAGS)) {
    const { [flag]: _omit, ...rest } = FLAGS;
    const result = audit({ 'tsconfig.json': { angularCompilerOptions: rest } });
    assert.equal(result.status, 'fail', flag);
    assert.match(result.message, new RegExp(flag), flag);
    assert.match(result.message, /no definido/, flag);
  }
});

test('fails naming a flag set to false and the file that sets it', () => {
  const result = audit({ 'tsconfig.json': { angularCompilerOptions: { ...FLAGS, strictTemplates: false } } });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /strictTemplates: false \(tsconfig\.json\)/);
});

test('without angularCompilerOptions all three flags are reported', () => {
  const result = audit({ 'tsconfig.json': { compilerOptions: { strict: true } } });
  assert.equal(result.status, 'fail');
  assert.equal(result.evidence.details.length, 3);
  assert.match(result.message, /3 problemas/);
});

test('flags inherited through extends count, and a leaf that turns one off is named', () => {
  const inherited = audit({ 'tsconfig.base.json': { angularCompilerOptions: FLAGS }, 'tsconfig.json': { extends: './tsconfig.base.json' } });
  assert.equal(inherited.status, 'pass');
  const overridden = audit({
    'tsconfig.base.json': { angularCompilerOptions: FLAGS },
    'tsconfig.json': { extends: './tsconfig.base.json', angularCompilerOptions: { strictTemplates: false } },
  });
  assert.equal(overridden.status, 'fail');
  assert.match(overridden.message, /strictTemplates: false \(tsconfig\.json\)/);
});

test('the file that defines a wrong value is the one named, even if it is inherited', () => {
  const result = audit({
    'tsconfig.base.json': { angularCompilerOptions: { ...FLAGS, strictInjectionParameters: false } },
    'tsconfig.json': { extends: './tsconfig.base.json' },
  });
  assert.match(text(result), /tsconfig\.base\.json/);
});

test('reads a tsconfig written with comments and trailing commas', () => {
  const content = '{\n // Angular\n "angularCompilerOptions": { "strictInjectionParameters": true, "strictInputAccessModifiers": true, "strictTemplates": true, },\n}';
  assert.equal(audit({ 'tsconfig.json': content }).status, 'pass');
});
