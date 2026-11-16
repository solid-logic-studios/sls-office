import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const engine = join(root, 'src', 'engine');
const FORBIDDEN = ['themes', 'page', 'simulator'].map((folder) => join(root, 'src', folder));

function sources(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

function imports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]/gm)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

describe('Engine architecture', () => {
  const files = sources(engine);

  it('finds the engine sources', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((file) => [relative(root, file), file]))(
    '%s imports nothing from the themes, the page or the simulator',
    (_name, file) => {
      for (const specifier of imports(file)) {
        if (!specifier.startsWith('.')) continue;
        const target = resolve(file, '..', specifier);
        for (const folder of FORBIDDEN) expect(target.startsWith(folder)).toBe(false);
      }
    },
  );

  it('uses no wall clock, no Math.random and no DOM inside the Engine', () => {
    for (const file of files) {
      // Comments may mention them; code may not.
      const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/\bnew Date\b|Date\.now|Math\.random|\bdocument\.|\bwindow\./);
    }
  });
});
