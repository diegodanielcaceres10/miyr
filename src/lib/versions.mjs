/** Major version of an exact version or of a range (its lower bound); null for tags, URLs, wildcards or nothing. */
export function majorOf(text) {
  const match = /^[\s^~>=<v]*(\d+)/.exec(String(text ?? '').trim());
  return match ? Number(match[1]) : null;
}
