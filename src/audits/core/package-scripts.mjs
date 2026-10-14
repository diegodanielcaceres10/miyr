import fs from 'node:fs';
import path from 'node:path';
import { readJson } from '../../lib/files.mjs';

export const id = 'core/package-scripts';
export const title = 'Scripts estándar en package.json';

const REQUIRED = ['start', 'build', 'test', 'lint'];

export function run({ cwd }) {
  const file = path.join(cwd, 'package.json');
  if (!fs.existsSync(file)) {
    return { id, title, status: 'fail', severity: 'high', message: 'No existe package.json en la raíz.' };
  }

  let pkg;
  try {
    pkg = readJson(file);
  } catch (err) {
    return { id, title, status: 'error', severity: 'high', message: `package.json inválido: ${err.message}` };
  }

  const scripts = pkg.scripts ?? {};
  const missing = REQUIRED.filter((name) => typeof scripts[name] !== 'string' || scripts[name].trim() === '');

  if (missing.length > 0) {
    return {
      id, title, status: 'fail', severity: 'high', evidence: { missing },
      message: `Faltan scripts obligatorios: ${missing.join(', ')}.`,
      fix: `Define ${missing.map((m) => `"${m}"`).join(', ')} en "scripts" de package.json.`,
    };
  }

  return { id, title, status: 'pass', severity: 'high', message: `Scripts presentes: ${REQUIRED.join(', ')}.` };
}
