import http from 'node:http';

/**
 * A local stand-in for the npm registry, so tests never reach the real network.
 * `hang: true` accepts connections and never answers. `requests` records every URL asked for.
 */
export async function startRegistry({ latest = '22.9.9', status = 200, body, hang = false } = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    if (hang) return;
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(body ?? JSON.stringify({ latest, next: '23.0.0-next.1', 'v21-lts': '21.2.9' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(resolve);
      }),
  };
}
