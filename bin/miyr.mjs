#!/usr/bin/env node
import path from 'node:path';
import { runAngularAudit } from '../src/audits/angular/index.mjs';

const args = process.argv.slice(2);
const [command, profile] = args;
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (command !== 'audit' || profile !== 'angular') {
  console.error('Uso: miyr audit angular [--cwd <ruta>] [--json]');
  process.exit(2);
}

const cwd = path.resolve(option('cwd') ?? process.cwd());
const results = runAngularAudit({ cwd });

if (flag('json')) {
  console.log(JSON.stringify({ profile, cwd, results }, null, 2));
} else {
  const icon = { pass: 'OK  ', fail: 'FAIL', error: 'ERR ' };
  for (const r of results) {
    console.log(`[${icon[r.status]}] ${r.title}`);
    console.log(`       ${r.message}`);
    if (r.evidence?.weakened) r.evidence.weakened.forEach((w) => console.log(`       - ${w}`));
    if (r.fix) console.log(`       -> ${r.fix}`);
  }
}

process.exit(results.every((r) => r.status === 'pass') ? 0 : 1);
