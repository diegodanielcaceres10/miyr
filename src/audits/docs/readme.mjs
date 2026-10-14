import { findFile, readText } from '../../lib/files.mjs';

export const id = 'docs/readme';
export const title = 'README con secciones obligatorias';
export const profile = 'core';

// Headings are matched by stem so both Spanish and English titles are accepted.
const SECTIONS = [
  { name: 'instalación', pattern: /instal|setup/i },
  { name: 'ejecución', pattern: /ejecu|run|usage|\buso\b|start|inici|arranque/i },
  { name: 'build', pattern: /build|compila/i },
  { name: 'pruebas', pattern: /test|prueba/i },
];

/** ATX headings outside fenced code blocks, so shell comments are not mistaken for titles. */
function headings(text) {
  const found = [];
  let fence = null;
  for (const line of text.split(/\r?\n/)) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) found.push(heading[1]);
  }
  return found;
}

export function run({ cwd }) {
  const file = findFile(cwd, ['README.md', 'README']);
  if (!file) return { id, title, status: 'fail', severity: 'medium', message: 'No existe README.md en la raíz.' };

  const text = readText(file);
  if (text.trim() === '') return { id, title, status: 'fail', severity: 'medium', message: 'El README está vacío.' };

  const titles = headings(text);
  const missing = SECTIONS.filter(({ pattern }) => !titles.some((t) => pattern.test(t))).map(({ name }) => name);

  if (missing.length > 0) {
    return {
      id, title, status: 'fail', severity: 'medium', evidence: { missing },
      message: `Al README le faltan secciones: ${missing.join(', ')}.`,
      fix: 'Añade un encabezado para cada sección faltante.',
    };
  }

  return { id, title, status: 'pass', severity: 'medium', message: 'README con instalación, ejecución, build y pruebas.' };
}
