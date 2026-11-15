import { fileURLToPath } from 'node:url';
import { createGenerator, type Schema } from 'ts-json-schema-generator';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Generates the snapshot v1 JSON Schema from the contract types. Nothing generated is committed. */
export function generateSnapshotSchema(): Schema {
  return createGenerator({
    path: `${root}src/contract/snapshot.ts`,
    tsconfig: `${root}tsconfig.json`,
    type: 'Snapshot',
    expose: 'export',
    topRef: false,
    skipTypeCheck: true,
  }).createSchema('Snapshot');
}
