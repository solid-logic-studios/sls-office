import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const sample = fileURLToPath(new URL('fixtures/snapshot.sample.json', import.meta.url));

/** Dev only: serves the sample fixture as /snapshot.json, re-read per request with `at` set to now. */
function devSnapshot(): Plugin {
  return {
    name: 'sls-office-dev-snapshot',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/snapshot.json', async (_request, response) => {
        const body = JSON.parse(await readFile(sample, 'utf8')) as Record<string, unknown>;
        body.at = new Date().toISOString();
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify(body));
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [devSnapshot()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
