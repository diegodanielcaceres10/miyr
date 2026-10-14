import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './files.mjs';

/** Loads package.json. Returns { pkg } or { failure: { status, message } } for the caller to report. */
export function loadPackage(cwd) {
  const file = path.join(cwd, 'package.json');
  if (!fs.existsSync(file)) return { failure: { status: 'fail', message: 'No existe package.json en la raíz.' } };
  try {
    const pkg = readJson(file);
    if (typeof pkg !== 'object' || pkg === null || Array.isArray(pkg)) throw new Error('debe ser un objeto JSON');
    return { pkg };
  } catch (err) {
    return { failure: { status: 'error', message: `package.json inválido: ${err.message}` } };
  }
}
