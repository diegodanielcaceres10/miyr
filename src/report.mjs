const ICON = { pass: 'OK  ', fail: 'FAIL', error: 'ERR ' };

export function summarize(results) {
  const counts = { pass: 0, fail: 0, error: 0 };
  for (const result of results) counts[result.status] += 1;
  return counts;
}

/** Plain text report, one block per project, easy to copy and paste. */
export function formatText({ projects }) {
  const lines = [];
  for (const project of projects) {
    if (lines.length > 0) lines.push('');
    lines.push(`== ${project.name} (${project.profile}, ruta: ${project.path}) ==`);
    for (const result of project.results) {
      lines.push(`[${ICON[result.status]}] ${result.title}`);
      lines.push(`       ${result.message}`);
      for (const item of result.evidence?.weakened ?? []) lines.push(`       - ${item}`);
      if (result.fix) lines.push(`       -> ${result.fix}`);
    }
    const { pass, fail, error } = summarize(project.results);
    lines.push(`Resumen: ${pass} OK, ${fail} FAIL, ${error} ERR`);
  }
  return lines.join('\n');
}
