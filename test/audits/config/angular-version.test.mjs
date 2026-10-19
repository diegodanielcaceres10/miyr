import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as check from '../../../src/audits/config/angular-version.mjs';
import { lockfile, project } from '../../../test-support/project.mjs';

const { run } = check;
const LATEST = { '@angular/core': { version: '22.2.3' } };

// A project folder with the given dependencies and, optionally, a lockfile resolving versions.
function ng({ deps = { '@angular/core': '^22.0.0' }, dev = {}, locked } = {}) {
  const files = { 'package.json': { name: 'app', dependencies: deps, devDependencies: dev } };
  if (locked) files['package-lock.json'] = lockfile(locked);
  return project(files);
}
const online = (cwd, latest = LATEST) => run({ cwd, online: true, latest });
const offline = (cwd) => run({ cwd });

test('declares what the registry has to be asked for', () => {
  assert.deepEqual(check.latestPackages, ['@angular/core']);
  assert.equal(check.profile, 'angular');
  assert.equal(check.level, 'B');
});

test('fails when package.json is missing', () => {
  assert.equal(offline(project({})).status, 'fail');
});

test('fails when the project does not declare @angular/core', () => {
  const result = offline(ng({ deps: { rxjs: '^7.0.0' } }));
  assert.equal(result.status, 'fail');
  assert.match(result.message, /@angular\/core/);
});

// --- without --online

test('without --online it is skipped, but still reports the version found in the lockfile', () => {
  const result = offline(ng({ locked: { '@angular/core': '19.2.4' } }));
  assert.equal(result.status, 'skip');
  assert.match(result.message, /19\.2\.4/);
  assert.match(result.message, /package-lock\.json/);
  assert.match(result.message, /--online/);
  assert.match(result.fix, /--online/);
});

test('without a lockfile the declared range is used and labelled as such', () => {
  const result = offline(ng({ deps: { '@angular/core': '^19.2.0' } }));
  assert.equal(result.status, 'skip');
  assert.match(result.message, /\^19\.2\.0/);
  assert.match(result.message, /rango declarado/);
});

test('the lockfile wins over the declared range', () => {
  const result = offline(ng({ deps: { '@angular/core': '^19.0.0' }, locked: { '@angular/core': '19.2.4' } }));
  assert.match(result.message, /19\.2\.4/);
  assert.doesNotMatch(result.message, /\^19\.0\.0/);
});

test('a version that cannot be determined is skipped with the reason', () => {
  for (const range of ['latest', '*', 'next', 'workspace:*', 'file:../core']) {
    const result = online(ng({ deps: { '@angular/core': range } }));
    assert.equal(result.status, 'skip', range);
    assert.match(result.message, /No se pudo determinar/, range);
  }
});

test('@angular/core may be a devDependency', () => {
  assert.equal(offline(ng({ deps: {}, dev: { '@angular/core': '^22.0.0' } })).status, 'skip');
});

// --- with --online

test('passes when the project is on the same major as the latest stable', () => {
  const result = online(ng({ locked: { '@angular/core': '22.0.1' } }));
  assert.equal(result.status, 'pass');
  assert.match(result.message, /22\.0\.1/);
  assert.match(result.message, /22\.2\.3/);
});

test('says so when the project is exactly on the latest stable', () => {
  const result = online(ng({ locked: { '@angular/core': '22.2.3' } }));
  assert.equal(result.status, 'pass');
  assert.match(result.message, /es la última estable/);
  assert.doesNotMatch(result.message, /misma versión mayor/);
});

test('passes when the project is ahead of the latest stable (a prerelease)', () => {
  const result = online(ng({ locked: { '@angular/core': '23.0.0-next.1' } }));
  assert.equal(result.status, 'pass');
  assert.match(result.message, /por delante/);
});

test('fails when behind by one major, with medium severity, naming both versions', () => {
  const result = online(ng({ locked: { '@angular/core': '21.4.0' } }));
  assert.equal(result.status, 'fail');
  assert.equal(result.severity, 'medium');
  assert.match(result.message, /21\.4\.0/);
  assert.match(result.message, /22\.2\.3/);
  assert.match(result.message, /1 versión mayor\b/);
  assert.match(result.fix, /ng update/);
});

test('fails with high severity when behind by two or more majors', () => {
  const two = online(ng({ locked: { '@angular/core': '20.3.1' } }));
  assert.equal(two.severity, 'high');
  assert.match(two.message, /2 versiones mayores/);
  const three = online(ng({ locked: { '@angular/core': '19.2.4' } }));
  assert.equal(three.severity, 'high');
  assert.match(three.message, /3 versiones mayores/);
});

test('compares the declared range when there is no lockfile', () => {
  const result = online(ng({ deps: { '@angular/core': '~19.2.0' } }));
  assert.equal(result.status, 'fail');
  assert.match(result.message, /~19\.2\.0/);
  assert.match(result.message, /rango declarado/);
});

test('an error from the registry is reported as an error with its reason', () => {
  const result = online(ng({ locked: { '@angular/core': '22.0.0' } }), { '@angular/core': { error: 'el registro respondió 503' } });
  assert.equal(result.status, 'error');
  assert.match(result.message, /503/);
});

test('--online without any data for the package is an error, not a pass', () => {
  assert.equal(online(ng({ locked: { '@angular/core': '22.0.0' } }), {}).status, 'error');
  assert.equal(run({ cwd: ng({ locked: { '@angular/core': '22.0.0' } }), online: true }).status, 'error');
});

// --- other @angular/* packages on a different major

test('fails when another @angular package is on a different major, listing it', () => {
  const cwd = ng({
    deps: { '@angular/core': '^22.0.0', '@angular/router': '^21.0.0' },
    dev: { '@angular/cli': '^20.0.0' },
    locked: { '@angular/core': '22.2.1', '@angular/router': '21.1.0', '@angular/cli': '20.3.2' },
  });
  for (const result of [offline(cwd), online(cwd)]) {
    assert.equal(result.status, 'fail');
    assert.equal(result.severity, 'high');
    assert.equal(result.evidence.details.length, 2);
    assert.ok(result.evidence.details.some((d) => d.includes('@angular/router') && d.includes('21.1.0')));
    assert.ok(result.evidence.details.some((d) => d.includes('@angular/cli') && d.includes('20.3.2')));
  }
});

test('the mismatch alone makes the check fail even when core is on the latest major', () => {
  const cwd = ng({ deps: { '@angular/core': '^22.0.0', '@angular/forms': '^21.0.0' }, locked: { '@angular/core': '22.2.3', '@angular/forms': '21.0.0' } });
  const result = online(cwd);
  assert.equal(result.status, 'fail');
  assert.match(result.message, /no comparten versión mayor/);
});

test('mismatches are also listed when core is behind the latest', () => {
  const cwd = ng({ deps: { '@angular/core': '^20.0.0', '@angular/router': '^19.0.0' }, locked: { '@angular/core': '20.1.0', '@angular/router': '19.0.0' } });
  const result = online(cwd);
  assert.match(result.message, /2 versiones mayores/);
  assert.equal(result.evidence.details.length, 1);
});

test('uses the declared range for another package when the lockfile does not list it', () => {
  const cwd = ng({ deps: { '@angular/core': '^22.0.0', '@angular/router': '^21.0.0' }, locked: { '@angular/core': '22.2.1' } });
  assert.equal(offline(cwd).status, 'fail');
});

test('@angular/fire has its own version numbers and is not compared', () => {
  const cwd = ng({ deps: { '@angular/core': '^22.0.0', '@angular/fire': '^19.0.0' }, locked: { '@angular/core': '22.2.1' } });
  assert.equal(offline(cwd).status, 'skip');
});

test('packages on the same major do not count as a mismatch', () => {
  const cwd = ng({ deps: { '@angular/core': '^22.0.0', '@angular/router': '^22.1.0' }, dev: { '@angular/cli': '~22.0.0' } });
  assert.equal(online(cwd).status, 'pass');
});

test('prerelease versions are read by their major', () => {
  const cwd = ng({ deps: { '@angular/core': '^22.0.0', '@angular/router': '^22.0.0' }, locked: { '@angular/core': '22.3.0-next.2', '@angular/router': '22.3.0-next.2' } });
  assert.equal(online(cwd).status, 'pass');
});
