/** Reads an .editorconfig: the keys before any section (`root`) and those of each [section], lowercased. */
export function parseEditorconfig(text) {
  const root = {};
  const sections = {};
  let current = root;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const section = line.match(/^\[(.+)\]$/);
    if (section) {
      current = sections[section[1]] ??= {};
      continue;
    }
    const pair = line.match(/^([^=:]+?)\s*[=:]\s*(.*)$/);
    if (pair) current[pair[1].trim().toLowerCase()] = pair[2].trim().toLowerCase();
  }
  return { root, sections };
}
