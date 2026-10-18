import readline from 'node:readline';
import { projectRows } from './report.mjs';

/**
 * Asks which project to audit. Returns the chosen project, or null when the user cancels
 * (empty answer or "q"), gives up after several invalid answers, or the input ends.
 */
export async function chooseProject(projects, { input, output, attempts = 3 }) {
  const rl = readline.createInterface({ input, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  try {
    output.write(`El manifiesto declara ${projects.length} proyectos. ¿Cuál auditar?\n`);
    projectRows(projects).forEach((row, i) => output.write(`  ${i + 1}) ${row}\n`));

    for (let attempt = 0; attempt < attempts; attempt++) {
      output.write('Número (Enter para cancelar): ');
      const { value, done } = await lines.next();
      if (done) {
        output.write('\n');
        return null;
      }
      const answer = value.trim().toLowerCase();
      if (answer === '' || answer === 'q') return null;
      if (/^\d+$/.test(answer) && Number(answer) >= 1 && Number(answer) <= projects.length) {
        return projects[Number(answer) - 1];
      }
      output.write('Opción no válida.\n');
    }
    return null;
  } finally {
    rl.close();
  }
}
