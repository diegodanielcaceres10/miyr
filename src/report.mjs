// Areas in display order. A check id is "<area>/<name>"; unknown areas go last.
const AREAS = [
  ['config', 'Configuración'],
  ['typing', 'Tipado'],
  ['testing', 'Testing'],
  ['git', 'Git'],
  ['ci', 'CI/CD'],
  ['docs', 'Documentación'],
];

const LABEL = { pass: 'OK  ', fail: 'FAIL', error: 'ERR ' };
const STATUS_COLOR = { pass: '32', fail: '31', error: '33' }; // green, red, yellow
const BOLD = '1';
const DIM = '2';

export function summarize(results) {
  const counts = { pass: 0, fail: 0, error: 0 };
  for (const result of results) counts[result.status] += 1;
  return counts;
}

const areaOf = (result) => result.id.split('/')[0];
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Results grouped by area, in the fixed area order (unknown areas last, in first-seen order). */
export function groupByArea(results) {
  const known = new Map(AREAS.map(([area, label]) => [area, { area, label, results: [] }]));
  const extra = new Map();
  for (const result of results) {
    const area = areaOf(result);
    if (known.has(area)) known.get(area).results.push(result);
    else if (extra.has(area)) extra.get(area).results.push(result);
    else extra.set(area, { area, label: capitalize(area), results: [result] });
  }
  return [...known.values(), ...extra.values()].filter((group) => group.results.length > 0);
}

function counts({ pass, fail, error }) {
  return [pass && `${pass} OK`, fail && `${fail} FAIL`, error && `${error} ERR`].filter(Boolean).join(', ');
}

/**
 * Plain text report: one block per project, grouped by area. Colors only wrap text,
 * so the output is identical once the escape codes are removed. Passing checks are
 * compact unless `verbose` is set; failures always show message, evidence and fix.
 */
export function formatText({ projects }, { color = false, verbose = false } = {}) {
  const paint = (code, text) => (color ? `\u001b[${code}m${text}\u001b[0m` : text);
  const lines = [];

  for (const project of projects) {
    if (lines.length > 0) lines.push('');
    lines.push(paint(BOLD, `== ${project.name} (${project.profile}, ruta: ${project.path}) ==`));

    for (const group of groupByArea(project.results)) {
      lines.push('');
      lines.push(paint(BOLD, `${group.label}: ${counts(summarize(group.results))}`));
      for (const result of group.results) {
        const status = paint(STATUS_COLOR[result.status], `[${LABEL[result.status]}]`);
        lines.push(`  ${status} ${result.title} ${paint(DIM, `(${result.id})`)}`);
        if (result.status !== 'pass' || verbose) lines.push(`         ${result.message}`);
        if (result.status === 'pass') continue;
        for (const item of result.evidence?.weakened ?? []) lines.push(`         - ${item}`);
        if (result.fix) lines.push(`         -> ${result.fix}`);
      }
    }

    const { pass, fail, error } = summarize(project.results);
    lines.push('');
    lines.push(`Resumen: ${pass} OK, ${fail} FAIL, ${error} ERR`);
  }
  return lines.join('\n');
}

/** One aligned line per project: name, profile and folder. */
export function projectRows(projects) {
  const width = (key) => Math.max(...projects.map((project) => project[key].length));
  return projects.map(
    (project) => `${project.name.padEnd(width('name'))}  ${project.profile.padEnd(width('profile'))}  ${project.path}`,
  );
}

/** Shown when a manifest declares several projects and none was chosen. `folder` is echoed as the user typed it. */
export function formatChoices(projects, { folder } = {}) {
  const rows = projectRows(projects).map((row) => `  ${row}`);
  const target = folder === undefined ? '' : ` ${/\s/.test(folder) ? `"${folder}"` : folder}`;
  return [
    `El manifiesto declara ${projects.length} proyectos. Elige uno con --project:`,
    '',
    ...rows,
    '',
    `Uno:    node bin/miyr.mjs audit --project ${projects[0].name}${target}`,
    `Todos:  node bin/miyr.mjs audit --all${target}`,
  ].join('\n');
}
