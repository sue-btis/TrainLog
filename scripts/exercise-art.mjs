import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const artDir = new URL('public/exercise-art/', root);
const dataFile = new URL('src/domain/catalog/data.ts', root);
const outFile = new URL('src/domain/catalog/art.ts', root);

const slugs = readdirSync(fileURLToPath(artDir))
  .filter((name) => name.endsWith('.svg'))
  .map((name) => name.slice(0, -'.svg'.length))
  .sort();

// Read the authored rows as text: this plain Node script cannot import aliased TypeScript.
const catalog = new Set(
  [...readFileSync(fileURLToPath(dataFile), 'utf8').matchAll(/^\s*\['([a-z0-9-]+)',/gm)].map(
    (match) => match[1],
  ),
);

const problems = [];
for (const slug of slugs) {
  if (!catalog.has(slug)) problems.push(`${slug}.svg — no catalog row has this id`);
  const svg = readFileSync(new URL(`${slug}.svg`, artDir), 'utf8');
  if (!svg.includes('viewBox')) problems.push(`${slug}.svg — no viewBox, so it cannot scale`);
}

if (problems.length > 0) {
  console.error(`${problems.length} drawing(s) rejected:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const lines = [];
let row = [];
for (const slug of slugs) {
  row.push(`'${slug}',`);
  if (row.join(' ').length > 88) {
    lines.push(`  ${row.join(' ')}`);
    row = [];
  }
}
if (row.length > 0) lines.push(`  ${row.join(' ')}`);

const missing = [...catalog].filter((slug) => !slugs.includes(slug));

writeFileSync(
  fileURLToPath(outFile),
  `const DRAWN: ReadonlySet<string> = new Set([
${lines.join('\n')}
]);

export function hasExerciseArt(id: string): boolean {
  return DRAWN.has(id);
}
`,
);

console.log(`art.ts: ${slugs.length} drawings, ${missing.length} catalog rows without one`);
