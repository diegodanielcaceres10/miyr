#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { profiles, runAudit } from '../src/audits/index.mjs';
import { findRepoRoot } from '../src/lib/context.mjs';
import { MANIFEST_FILE, loadManifest, missingManifestMessage } from '../src/lib/manifest.mjs';
import { formatChoices, formatText } from '../src/report.mjs';

const USAGE = `Uso:
  miyr audit [carpeta] [--project <nombre> | --all]   Audita los proyectos de ${MANIFEST_FILE} en esa carpeta
  miyr audit <perfil> [carpeta]                       Audita la carpeta con el perfil indicado
Sin carpeta se usa la actual. --cwd <carpeta> equivale a pasarla como argumento.
Opciones: --json  --verbose  --color  --no-color
Perfiles: ${Object.keys(profiles).join(', ')}`;

const fail = (message, withUsage = false) => {
  console.error(withUsage ? `${message}\n\n${USAGE}` : message);
  process.exit(2);
};

const args = process.argv.slice(2);
if (args[0] !== 'audit') fail('Comando desconocido o ausente.', true);

const VALUE_OPTIONS = ['cwd', 'project'];
const FLAGS = ['json', 'verbose', 'color', 'no-color', 'all'];
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

// A first word that names a profile selects explicit mode; anything else is the folder.
const rest = [...positional];
const profile = rest.length > 0 && Object.hasOwn(profiles, rest[0]) ? rest.shift() : null;
if (rest.length > 1) fail(`Argumentos de más: ${rest.slice(1).join(' ')}`, true);
if (rest.length === 1 && !isDirectory(path.resolve(rest[0]))) {
  fail(`"${rest[0]}" no es un perfil conocido ni una carpeta existente.`, true);
}
if (rest.length === 1 && options.cwd !== undefined) fail('Indica la carpeta una sola vez: como argumento o con --cwd.', true);

const folder = rest[0] ?? options.cwd;
const posixRelative = (from, to) => path.relative(from, to).split(path.sep).join('/') || '.';

const start = path.resolve(folder ?? process.cwd());
if (!isDirectory(start)) fail(`No existe la carpeta: ${start}`);
// Repo-level files (README, LICENSE, workflows...) are searched up to the git root. The manifest is not:
// it must be exactly in `start`, the folder given (or the current one).
const root = findRepoRoot(start) ?? start;

// Nothing is audited unless the folder given has a manifest of its own (both modes).
function requireManifest() {
  if (!fs.existsSync(path.join(start, MANIFEST_FILE))) fail(missingManifestMessage(start));
}

let targets;
if (profile) {
  // Explicit mode: the profile comes from the command line and the folder is the project.
  if (options.project !== undefined) fail('--project solo se usa con el manifiesto (sin indicar perfil).', true);
  if (flags.has('all')) fail('--all solo se usa con el manifiesto (sin indicar perfil).', true);
  requireManifest();
  targets = [{ name: path.basename(start), path: posixRelative(root, start), dir: start, profile }];
} else {
  // Manifest mode: the manifest in the given folder declares where each project lives.
  if (options.project !== undefined && flags.has('all')) fail('--project y --all no se pueden combinar.', true);
  requireManifest();
  const { projects, error } = loadManifest(start, Object.keys(profiles));
  if (error) fail(error);
  if (options.project !== undefined) {
    targets = projects.filter((p) => p.name === options.project);
    if (targets.length === 0) fail(`Proyecto desconocido: ${options.project}. Disponibles: ${projects.map((p) => p.name).join(', ')}`);
  } else if (flags.has('all') || projects.length === 1) {
    targets = projects;
  } else {
    // Several projects and none chosen: show the options on stderr, audit nothing.
    fail(formatChoices(projects, { folder }));
  }
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
