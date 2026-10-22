import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../../src/audits/ci/workflow.mjs';
import path from 'node:path';
import { WORKFLOW, project, workflowFor } from '../../../test-support/project.mjs';

const ci = (files) => run({ cwd: project(files) });

test('fails when there is no workflows directory', () => {
  assert.equal(ci({}).status, 'fail');
});

test('passes with inline run commands and push/pull_request triggers', () => {
  assert.equal(ci({ '.github/workflows/ci.yml': WORKFLOW }).status, 'pass');
});

test('passes with block scalar commands and a block-style trigger', () => {
  const content = `name: CI
on:
  pull_request:
    branches: [main]
jobs:
  ci:
    steps:
      - name: Validate
        run: |
          npm ci
          npx ng lint
          npx ng test --watch=false
          npx ng build
`;
  assert.equal(ci({ '.github/workflows/ci.yaml': content }).status, 'pass');
});

test('recognizes pnpm and yarn commands and a scalar trigger', () => {
  const content = 'on: push\njobs:\n  ci:\n    steps:\n      - run: pnpm lint\n      - run: yarn test\n      - run: pnpm run build\n';
  assert.equal(ci({ '.github/workflows/ci.yml': content }).status, 'pass');
});

test('fails and lists the missing steps', () => {
  const content = 'on: [push]\njobs:\n  ci:\n    steps:\n      - run: npm run lint\n';
  const result = ci({ '.github/workflows/ci.yml': content });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /test/);
  assert.match(result.message, /build/);
  assert.doesNotMatch(result.message, /lint/);
});

test('fails when the workflow is not triggered by push or pull_request', () => {
  const content = WORKFLOW.replace('on: [push, pull_request]', 'on: workflow_dispatch');
  const result = ci({ '.github/workflows/ci.yml': content });
  assert.equal(result.status, 'fail');
});

test('does not treat a step name or a comment as a command', () => {
  const content = `on: push
jobs:
  ci:
    steps:
      - name: Run lint
        run: echo hello
      # - run: npm run lint
      - run: npm test
      - run: npm run build
`;
  const result = ci({ '.github/workflows/ci.yml': content });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /lint/);
});

test('accepts the steps split across several workflow files', () => {
  const a = 'on: push\njobs:\n  lint:\n    steps:\n      - run: npm run lint\n';
  const b = 'on: pull_request\njobs:\n  verify:\n    steps:\n      - run: npm test\n      - run: npm run build\n';
  const result = ci({ '.github/workflows/lint.yml': a, '.github/workflows/verify.yml': b });
  assert.equal(result.status, 'pass');
  assert.equal(result.evidence.workflows.length, 2);
});

test('ignores workflows that are not triggered by push or pull_request', () => {
  const manual = 'on: workflow_dispatch\njobs:\n  x:\n    steps:\n      - run: npm run lint\n      - run: npm test\n      - run: npm run build\n';
  assert.equal(ci({ '.github/workflows/manual.yml': manual }).status, 'fail');
});

test('does not count a commented-out trigger inside the on block', () => {
  const content = `on:
  # push:
  workflow_dispatch:
jobs:
  ci:
    steps:
      - run: npm run lint
      - run: npm test
      - run: npm run build
`;
  assert.equal(ci({ '.github/workflows/ci.yml': content }).status, 'fail');
});

test('does not count a commented-out command inside a block scalar', () => {
  const content = `on: push
jobs:
  ci:
    steps:
      - run: |
          # npm run lint
          npm test
          npm run build
`;
  const result = ci({ '.github/workflows/ci.yml': content });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /lint/);
});

// --- which workflows belong to the project

// The CI lives at the repository root and the project in web/.
function shared(files, workflows, folder = 'web') {
  const root = project({ '.git/HEAD': 'x', ...files });
  return run({ cwd: path.join(root, folder), root, locations: { ci: root }, workflows });
}
const WF = '.github/workflows';
const withBody = (body) => `on: push\njobs:\n  ci:\n${body}\n    steps:\n      - run: npm run lint\n      - run: npm test\n      - run: npm run build\n`;

test('only the declared workflows are evaluated', () => {
  const files = { [`${WF}/ci_web.yml`]: workflowFor('web'), [`${WF}/ci_other.yml`]: 'on: push\njobs:\n  x:\n    steps:\n      - run: npm run lint\n' };
  assert.equal(shared(files, ['ci_web.yml']).status, 'pass');
  const other = shared(files, ['ci_other.yml']);
  assert.equal(other.status, 'fail');
  assert.match(other.message, /test/);
});

test('a declared workflow that does not exist is a failure naming it', () => {
  const result = shared({ [`${WF}/ci_web.yml`]: workflowFor('web') }, ['ci_web.yml', 'deploy_web.yml', 'extra.yaml']);
  assert.equal(result.status, 'fail');
  assert.match(result.message, /deploy_web\.yml/);
  assert.match(result.message, /extra\.yaml/);
  assert.doesNotMatch(result.message, /ci_web\.yml/);
  assert.match(result.fix, /shared\.ci/);
});

test('declared names match the files whatever their case', () => {
  assert.equal(shared({ [`${WF}/ci_web.yml`]: workflowFor('web') }, ['CI_WEB.YML']).status, 'pass');
});

test('a shared CI whose workflows are not declared is skipped, not approved', () => {
  const result = shared({ [`${WF}/ci.yml`]: workflowFor('web') }, undefined);
  assert.equal(result.status, 'skip');
  assert.match(result.message, /workflows/);
  assert.match(result.message, /declara/i);
  assert.match(result.fix, /"workflows"/);
  assert.equal(shared({ [`${WF}/ci.yml`]: workflowFor('web') }, []).status, 'skip');
});

test('a shared CI with no workflow files at all fails even when nothing is declared', () => {
  assert.equal(shared({ 'README.md': 'x' }, undefined).status, 'fail');
});

test('when the CI lives in the project folder there is nothing to attribute', () => {
  assert.equal(ci({ [`${WF}/ci.yml`]: WORKFLOW }).status, 'pass');
  const root = project({ [`web/${WF}/any.yml`]: WORKFLOW });
  assert.equal(run({ cwd: path.join(root, 'web'), workflows: ['any.yml'] }).status, 'pass');
});

test('a declared workflow must refer to the project folder through "paths"', () => {
  const ok = withBody("    runs-on: x").replace('on: push', "on:\n  push:\n    paths:\n      - 'web/**'");
  assert.equal(shared({ [`${WF}/a.yml`]: ok }, ['a.yml']).status, 'pass');
  const wrong = ok.replace('web/**', 'dashboard/**');
  const result = shared({ [`${WF}/a.yml`]: wrong }, ['a.yml']);
  assert.equal(result.status, 'fail');
  assert.match(result.message, /a\.yml/);
  assert.match(result.message, /no hace referencia a la carpeta web/);
});

test('"paths" may be written inline, quoted and with a leading ./', () => {
  const inline = withBody('    runs-on: x').replace('on: push', "on:\n  pull_request:\n    paths: [ 'docs/**', \"./web/**\" ]");
  assert.equal(shared({ [`${WF}/a.yml`]: inline }, ['a.yml']).status, 'pass');
});

test('"paths-ignore" does not count as a reference', () => {
  const ignoring = withBody('    runs-on: x').replace('on: push', "on:\n  push:\n    paths-ignore:\n      - 'web/**'");
  assert.equal(shared({ [`${WF}/a.yml`]: ignoring }, ['a.yml']).status, 'fail');
});

test('a declared workflow may refer to the project through "working-directory"', () => {
  for (const value of ['web', "'./web'", 'web/src']) {
    const body = `    runs-on: x\n    defaults:\n      run:\n        working-directory: ${value}`;
    assert.equal(shared({ [`${WF}/a.yml`]: withBody(body) }, ['a.yml']).status, 'pass', value);
  }
  const body = '    runs-on: x\n    defaults:\n      run:\n        working-directory: webapp';
  assert.equal(shared({ [`${WF}/a.yml`]: withBody(body) }, ['a.yml']).status, 'fail');
});

test('a declared workflow may refer to the project in a command', () => {
  for (const command of ['cd web && npm ci', 'npm ci --prefix web', 'npm test --prefix=web', 'npm run build -w web', 'make -C web']) {
    const text = `on: push\njobs:\n  ci:\n    steps:\n      - run: ${command}\n      - run: npm run lint\n      - run: npm test\n      - run: npm run build\n`;
    assert.equal(shared({ [`${WF}/a.yml`]: text }, ['a.yml']).status, 'pass', command);
  }
  const text = 'on: push\njobs:\n  ci:\n    steps:\n      - run: cd webapp && npm ci\n      - run: npm run lint\n      - run: npm test\n      - run: npm run build\n';
  assert.equal(shared({ [`${WF}/a.yml`]: text }, ['a.yml']).status, 'fail');
});

test('a commented-out reference does not count', () => {
  const commented = withBody('    runs-on: x\n    # working-directory: web');
  assert.equal(shared({ [`${WF}/a.yml`]: commented }, ['a.yml']).status, 'fail');
});

test('a commented shell line inside a multi-line run does not count', () => {
  const text = 'on: push\njobs:\n  ci:\n    steps:\n      - run: |\n          # cd web\n          npm run lint\n          npm test\n          npm run build\n';
  assert.equal(shared({ [`${WF}/a.yml`]: text }, ['a.yml']).status, 'fail');
  const real = text.replace('# cd web', 'cd web');
  assert.equal(shared({ [`${WF}/a.yml`]: real }, ['a.yml']).status, 'pass');
});

test('a nested project folder is matched as a whole path', () => {
  const nested = withBody('    runs-on: x\n    defaults:\n      run:\n        working-directory: apps/web');
  assert.equal(shared({ [`${WF}/a.yml`]: nested, 'apps/web/package.json': '{}' }, ['a.yml'], 'apps/web').status, 'pass');
  const shallow = withBody('    runs-on: x\n    defaults:\n      run:\n        working-directory: web');
  assert.equal(shared({ [`${WF}/a.yml`]: shallow, 'apps/web/package.json': '{}' }, ['a.yml'], 'apps/web').status, 'fail');
});

test('every declared workflow must refer to the project, and only the ones that do not are named', () => {
  const files = { [`${WF}/ci_web.yml`]: workflowFor('web'), [`${WF}/deploy_web.yml`]: 'on: workflow_dispatch\njobs:\n  d:\n    steps:\n      - run: echo deploy\n' };
  const result = shared(files, ['ci_web.yml', 'deploy_web.yml']);
  assert.equal(result.status, 'fail');
  assert.match(result.message, /deploy_web\.yml/);
  assert.doesNotMatch(result.message, /ci_web\.yml/);
});

test('a declared workflow without push or pull_request still counts as the project\'s, but not for coverage', () => {
  const deploy = 'on: workflow_dispatch\njobs:\n  d:\n    defaults:\n      run:\n        working-directory: web\n    steps:\n      - run: echo deploy\n';
  const files = { [`${WF}/ci_web.yml`]: workflowFor('web'), [`${WF}/deploy_web.yml`]: deploy };
  const result = shared(files, ['ci_web.yml', 'deploy_web.yml']);
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.evidence.workflows, ['ci_web.yml']);
});

test('a declared workflow set that never runs on push or pull_request fails', () => {
  const manual = 'on: workflow_dispatch\njobs:\n  x:\n    defaults:\n      run:\n        working-directory: web\n    steps:\n      - run: npm run lint\n      - run: npm test\n      - run: npm run build\n';
  assert.equal(shared({ [`${WF}/a.yml`]: manual }, ['a.yml']).status, 'fail');
});
