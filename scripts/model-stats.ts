/**
 * Estadísticas del modelo esquemático: tiempo de generación, triángulos por malla y
 * mallas vacías. Uso: npx vite-node scripts/model-stats.ts
 */
import { buildDogSchematicParts } from '../src/species/dog/schematicModel';

const t0 = performance.now();
const parts = buildDogSchematicParts();
const ms = performance.now() - t0;
let tris = 0;
const rows = parts.map((p) => {
  const n = (p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count) / 3;
  tris += n;
  return { name: p.name, tris: n };
});
rows.sort((a, b) => b.tris - a.tris);
console.log(`Mallas: ${parts.length}  ·  triángulos: ${Math.round(tris).toLocaleString('es')}  ·  generación: ${Math.round(ms)} ms`);
console.log('Más pesadas:', rows.slice(0, 8).map((r) => `${r.name} ${Math.round(r.tris)}`).join(', '));
const empty = rows.filter((r) => r.tris < 20);
console.log(empty.length ? `VACÍAS O CASI: ${empty.map((r) => `${r.name}(${r.tris})`).join(', ')}` : 'Sin mallas vacías');
