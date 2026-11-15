import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSnapshotSchema } from './snapshot-schema.ts';

const out = fileURLToPath(new URL('../dist/schema/snapshot.v1.schema.json', import.meta.url));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(generateSnapshotSchema(), null, 2)}\n`);
console.log(`Wrote ${out}`);
