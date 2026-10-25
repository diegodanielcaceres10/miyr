/**
 * A failure that gathers every problem found by a check: the problem itself when there is one,
 * a count with the list under it when there are several. Returns null when there is none.
 */
export function problemsResult({ id, title }, subject, problems, fix) {
  if (problems.length === 0) return null;
  const several = problems.length > 1;
  return {
    id, title, status: 'fail',
    message: several ? `${subject}: ${problems.length} problemas.` : problems[0],
    ...(several ? { evidence: { details: problems } } : {}),
    ...(fix ? { fix } : {}),
  };
}
