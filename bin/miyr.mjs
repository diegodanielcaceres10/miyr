#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { profiles, runAudit } from '../src/audits/index.mjs';
import { findRepoRoot } from '../src/lib/context.mjs';
import { MANIFEST_FILE, loadManifest, missingManifestMessage } from '../src/lib/manifest.mjs';
import { chooseProject } from '../src/prompt.mjs';
import { formatChoices, formatText } from '../src/report.mjs';

const USAGE = `Uso:
  miyr audit [carpeta] [--project <nombre> | --all | --choose]
Audita los proyectos que declara el ${MANIFEST_FILE} de esa carpeta (sin carpeta, la actual).
--cwd <carpeta> equivale a pasarla como argumento. El perfil de cada proyecto se declara en el manifiesto.
Opciones: --json  --verbose  --color  --no-color`;

const fail = (message, withUsage = false) => {
  console.error(withUsage ? `${message}\n\n${USAGE}` : message);
  process.exit(2);
};

const args = process.argv.slice(2);
if (args[0] !== 'audit') fail('Comando desconocido o ausente.', true);

const VALUE_OPTIONS = ['cwd', 'project'];
const FLAGS = ['json', 'verbose', 'color', 'no-color', 'all', 'choose'];
const options = {};
const flags = new Set();
const positional = [];
for (let i = 1; i < args.length; i++) {
  const token = args[i];
  if (!token.startsWith('--')) {
    positional.push(token);
    continue;
  }
  const name = token.slice(2);
  if (VALUE_OPTIONS.includes(name)) {
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) fail(`Falta el valor de --${name}`, true);
    options[name] = value;
    i += 1;
  } else if (FLAGS.includes(name)) {
    flags.add(name);
  } else {
    fail(`Opción desconocida: ${token}`, true);
  }
}

const isDirectory = (dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory();

const rest = [...positional];
if (rest.length > 0 && Object.hasOwn(profiles, rest[0]) && !isDirectory(path.resolve(rest[0]))) {
  fail(`"${rest[0]}" es un perfil, pero el perfil ya no se pasa por comando: se declara en "profile" de cada proyecto en ${MANIFEST_FILE}.`, true);
}
if (rest.length > 1) fail(`Argumentos de más: ${rest.slice(1).join(' ')}`, true);
if (rest.length === 1 && !isDirectory(path.resolve(rest[0]))) fail(`"${rest[0]}" no es una carpeta existente.`, true);
if (rest.length === 1 && options.cwd !== undefined) fail('Indica la carpeta una sola vez: como argumento o con --cwd.', true);
if (options.project !== undefined && flags.has('all')) fail('--project y --all no se pueden combinar.', true);
if (flags.has('choose') && (options.project !== undefined || flags.has('all'))) {
  fail('--choose no se combina con --project ni con --all.', true);
}

const folder = rest[0] ?? options.cwd;
const start = path.resolve(folder ?? process.cwd());
if (!isDirectory(start)) fail(`No existe la carpeta: ${start}`);

// Repo-level files (README, LICENSE, workflows...) are searched up to the git root. The manifest is not:
// it must be exactly in `start`, the folder given (or the current one).
const root = findRepoRoot(start) ?? start;

// Nothing is audited unless the folder given has a manifest of its own.
if (!fs.existsSync(path.join(start, MANIFEST_FILE))) fail(missingManifestMessage(start));

const { projects, error } = loadManifest(start, Object.keys(profiles));
if (error) fail(error);

let targets;
if (options.project !== undefined) {
  targets = projects.filter((p) => p.name === options.project);
  if (targets.length === 0) fail(`Proyecto desconocido: ${options.project}. Disponibles: ${projects.map((p) => p.name).join(', ')}`);
} else if (flags.has('all') || projects.length === 1) {
  targets = projects;
} else if (flags.has('choose') || (process.stdin.isTTY && process.stderr.isTTY)) {
  // Several projects and none named: ask. The menu goes to stderr, so stdout only ever carries the report.
  const chosen = await chooseProject(projects, { input: process.stdin, output: process.stderr });
  if (!chosen) fail('No se eligió ningún proyecto.');
  targets = [chosen];
} else {
  // No terminal to ask on (CI, pipes): show the options and audit nothing.
  fail(formatChoices(projects, { folder }));
}

const report = {
  root,
  projects: targets.map((t) => ({
    name: t.name,
    path: t.path,
    profile: t.profile,
    results: runAudit(t.profile, { cwd: t.dir, root }),
  })),
};

// Colors only on a real terminal (or when forced), and never when NO_COLOR is set.
const color = !flags.has('no-color') && (flags.has('color') || (process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb'));
console.log(flags.has('json') ? JSON.stringify(report, null, 2) : formatText(report, { color, verbose: flags.has('verbose') }));
process.exitCode = report.projects.every((p) => p.results.every((r) => r.status === 'pass')) ? 0 : 1;
