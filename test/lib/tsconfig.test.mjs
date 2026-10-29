import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { effectiveOptions, loadRootTsconfig, loadTsconfigChain } from '../../src/lib/tsconfig.mjs';
import { project } from '../../test-support/project.mjs';

test('loadRootTsconfig says the file does not exist', () => {
  const result = loadRootTsconfig(project({}));
  assert.match(result.problem, /No existe tsconfig\.json/);
  assert.equal(result.chain, undefined);
});

test('loadRootTsconfig says the file is invalid, with the reason', () => {
  const result = loadRootTsconfig(project({ 'tsconfig.json': '{ nope' }));
  assert.match(result.problem, /tsconfig\.json inválido/);
  assert.doesNotMatch(result.problem, /No existe/);
});

test('loadRootTsconfig returns the entry and its chain from base to leaf', () => {
  const cwd = project({ 'tsconfig.base.json': { compilerOptions: { strict: true } }, 'tsconfig.json': { extends: './tsconfig.base.json' } });
  const result = loadRootTsconfig(cwd);
  assert.equal(result.problem, undefined);
  assert.equal(result.entry, path.join(cwd, 'tsconfig.json'));
  assert.deepEqual(result.chain.map((c) => path.basename(c.file)), ['tsconfig.base.json', 'tsconfig.json']);
});

test('effectiveOptions lets the leaf win and remembers which file defined each option', () => {
  const cwd = project({
    'tsconfig.base.json': { compilerOptions: { strict: true, target: 'ES2020' } },
    'tsconfig.json': { extends: './tsconfig.base.json', compilerOptions: { strict: false } },
  });
  const options = effectiveOptions(loadTsconfigChain(path.join(cwd, 'tsconfig.json')));
  assert.equal(options.strict.value, false);
  assert.equal(path.basename(options.strict.file), 'tsconfig.json');
  assert.equal(options.target.value, 'ES2020');
  assert.equal(path.basename(options.target.file), 'tsconfig.base.json');
});

test('effectiveOptions can read another section, such as angularCompilerOptions', () => {
  const cwd = project({ 'tsconfig.json': { compilerOptions: { strict: true }, angularCompilerOptions: { strictTemplates: true } } });
  const options = effectiveOptions(loadTsconfigChain(path.join(cwd, 'tsconfig.json')), 'angularCompilerOptions');
  assert.deepEqual(Object.keys(options), ['strictTemplates']);
});

test('loadTsconfigChain follows a list of extends in order, so the last one wins', () => {
  const cwd = project({
    'a.json': { compilerOptions: { noImplicitAny: true } },
    'b.json': { compilerOptions: { noImplicitAny: false } },
    'tsconfig.json': { extends: ['./a.json', './b.json'] },
  });
  const chain = loadTsconfigChain(path.join(cwd, 'tsconfig.json'));
  assert.deepEqual(chain.map((c) => path.basename(c.file)), ['a.json', 'b.json', 'tsconfig.json']);
  assert.equal(effectiveOptions(chain).noImplicitAny.value, false);
});

test('loadTsconfigChain accepts extends without the .json extension', () => {
  const cwd = project({ 'base.json': {}, 'tsconfig.json': { extends: './base' } });
  assert.deepEqual(loadTsconfigChain(path.join(cwd, 'tsconfig.json')).map((c) => path.basename(c.file)), ['base.json', 'tsconfig.json']);
});

test('loadTsconfigChain does not loop on a cycle', () => {
  const cwd = project({ 'a.json': { extends: './tsconfig.json' }, 'tsconfig.json': { extends: './a.json' } });
  assert.equal(loadTsconfigChain(path.join(cwd, 'tsconfig.json')).length, 2);
});

test('loadTsconfigChain ignores an extends that points to nothing', () => {
  const cwd = project({ 'tsconfig.json': { extends: './missing.json', compilerOptions: { strict: true } } });
  assert.deepEqual(loadTsconfigChain(path.join(cwd, 'tsconfig.json')).map((c) => path.basename(c.file)), ['tsconfig.json']);
});
