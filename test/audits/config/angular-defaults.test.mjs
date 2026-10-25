import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as check from '../../../src/audits/config/angular-defaults.mjs';
import { lockfile, project } from '../../../test-support/project.mjs';

const { run } = check;
const COMPONENT = '@schematics/angular:component';
const DIRECTIVE = '@schematics/angular:directive';
const PIPE = '@schematics/angular:pipe';
const PKG = { name: 'app', dependencies: { '@angular/core': '^22.0.0' } };

const app = (schematics) => ({ projectType: 'application', ...(schematics ? { schematics } : {}) });
const withStyle = (style) => app({ [COMPONENT]: { style } });

// A project folder with the given angular.json; null removes an entry.
function ws(angularJson, overrides = {}) {
  const files = { 'package.json': PKG, 'angular.json': angularJson, ...overrides };
  for (const [name, content] of Object.entries(files)) if (content === null) delete files[name];
  return project(files);
}
const audit = (angularJson, overrides) => run({ cwd: ws(angularJson, overrides) });
const single = (schematics, overrides) => audit({ projects: { app: app(schematics) } }, overrides);
const details = (result) => result.evidence?.details?.join(' ') ?? result.message;
const OLD = { 'package-lock.json': lockfile({ '@angular/core': '18.2.0' }) };
const ALL_STANDALONE = { [COMPONENT]: { style: 'scss', standalone: true }, [DIRECTIVE]: { standalone: true }, [PIPE]: { standalone: true } };

test('declares its place in the report', () => {
  assert.deepEqual([check.id, check.profile, check.level], ['config/angular-defaults', 'angular', 'C']);
});

test('fails when package.json is missing', () => {
  assert.equal(run({ cwd: project({ 'angular.json': { projects: {} } }) }).status, 'fail');
});

test('fails when angular.json is missing or cannot be read', () => {
  assert.match(audit(null).message, /angular\.json/);
  assert.equal(audit(null).status, 'fail');
  const broken = audit('{ not json');
  assert.equal(broken.status, 'fail');
  assert.match(broken.message, /angular\.json/);
});

test('angular.json may contain comments and trailing commas', () => {
  const text = '{\n // projects\n "projects": { "app": { "projectType": "application", "schematics": { "@schematics/angular:component": { "style": "scss", }, }, }, },\n}';
  assert.equal(audit(text).status, 'pass');
});

test('passes with scss or sass', () => {
  for (const style of ['scss', 'sass']) assert.equal(audit({ projects: { app: withStyle(style) } }).status, 'pass', style);
});

test('css is only accepted when the project uses tailwindcss', () => {
  const css = { projects: { app: withStyle('css') } };
  const without = audit(css);
  assert.equal(without.status, 'fail');
  assert.match(without.message, /css/);
  assert.match(without.message, /tailwindcss/);
  assert.equal(audit(css, { 'package.json': { ...PKG, devDependencies: { tailwindcss: '^4.0.0' } } }).status, 'pass');
  assert.equal(audit(css, { 'package.json': { ...PKG, dependencies: { ...PKG.dependencies, tailwindcss: '^4.0.0' } } }).status, 'pass');
});

test('other preprocessors fail even with tailwindcss', () => {
  for (const style of ['less', 'styl']) {
    const result = audit({ projects: { app: withStyle(style) } }, { 'package.json': { ...PKG, devDependencies: { tailwindcss: '^4.0.0' } } });
    assert.equal(result.status, 'fail', style);
    assert.match(result.message, new RegExp(style), style);
  }
});

test('an undeclared style is css, the Angular default', () => {
  const none = { projects: { app: app() } };
  assert.equal(audit(none).status, 'fail');
  assert.equal(audit(none, { 'package.json': { ...PKG, devDependencies: { tailwindcss: '^4.0.0' } } }).status, 'pass');
});

test('the project schematics override the ones at the root of angular.json', () => {
  const rootScss = { schematics: { [COMPONENT]: { style: 'scss' } }, projects: { app: withStyle('css') } };
  assert.equal(audit(rootScss).status, 'fail');
  const rootCss = { schematics: { [COMPONENT]: { style: 'css' } }, projects: { app: withStyle('scss') } };
  assert.equal(audit(rootCss).status, 'pass');
  assert.equal(audit({ schematics: { [COMPONENT]: { style: 'scss' } }, projects: { app: app() } }).status, 'pass');
});

test('from Angular 19 standalone is the default: absent or true pass, false fails', () => {
  for (const kind of [COMPONENT, DIRECTIVE, PIPE]) {
    assert.equal(single({ [COMPONENT]: { style: 'scss' }, [kind]: { ...(kind === COMPONENT ? { style: 'scss' } : {}), standalone: true } }).status, 'pass', kind);
    const result = single({ [COMPONENT]: { style: 'scss' }, [kind]: { ...(kind === COMPONENT ? { style: 'scss' } : {}), standalone: false } });
    assert.equal(result.status, 'fail', kind);
    assert.match(result.message, /standalone/, kind);
  }
  assert.equal(single({ [COMPONENT]: { style: 'scss' } }).status, 'pass');
});

test('before Angular 19 standalone: true must be explicit for components, directives and pipes', () => {
  assert.equal(single(ALL_STANDALONE, OLD).status, 'pass');
  const missing = single({ [COMPONENT]: { style: 'scss', standalone: true } }, OLD);
  assert.equal(missing.status, 'fail');
  assert.match(details(missing), /directive/);
  assert.match(details(missing), /pipe/);
  assert.doesNotMatch(details(missing), /component/);
  const off = single({ ...ALL_STANDALONE, [PIPE]: { standalone: false } }, OLD);
  assert.equal(off.status, 'fail');
});

test('before Angular 19 the explicit standalone may be declared at the root', () => {
  const root = { schematics: { [DIRECTIVE]: { standalone: true }, [PIPE]: { standalone: true } }, projects: { app: app({ [COMPONENT]: { style: 'scss', standalone: true } }) } };
  assert.equal(audit(root, OLD).status, 'pass');
});

test('the Angular version is also read from the declared range when there is no lockfile', () => {
  const result = single({ [COMPONENT]: { style: 'scss' } }, { 'package.json': { name: 'app', dependencies: { '@angular/core': '~18.1.0' } } });
  assert.equal(result.status, 'fail');
  assert.match(details(result), /standalone/);
});

test('with an unknown Angular version standalone: true is not demanded, but false is rejected', () => {
  const latest = { 'package.json': { name: 'app', dependencies: { '@angular/core': 'latest' } } };
  assert.equal(single({ [COMPONENT]: { style: 'scss' } }, latest).status, 'pass');
  assert.equal(single({ [COMPONENT]: { style: 'scss', standalone: false } }, latest).status, 'fail');
});

test('only applications are checked, libraries are ignored', () => {
  const result = audit({ projects: { lib: { projectType: 'library', schematics: { [COMPONENT]: { style: 'less' } } }, app: withStyle('scss') } });
  assert.equal(result.status, 'pass');
});

test('an angular.json with no application fails', () => {
  assert.equal(audit({ projects: { lib: { projectType: 'library' } } }).status, 'fail');
  assert.equal(audit({}).status, 'fail');
});

test('every application is checked and the failing ones are named', () => {
  const result = audit({ projects: { web: withStyle('scss'), admin: withStyle('less'), shop: withStyle('css') } });
  assert.equal(result.status, 'fail');
  assert.match(details(result), /admin/);
  assert.match(details(result), /shop/);
  assert.doesNotMatch(details(result), /web/);
});

test('style and standalone problems of one project are reported together', () => {
  const result = single({ [COMPONENT]: { style: 'less', standalone: false } });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /problemas/);
  assert.equal(result.evidence.details.length, 2);
});
