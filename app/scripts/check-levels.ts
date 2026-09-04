import { ALL } from '../src/data';
import { levelOf } from '../src/data/difficulty';

const counts: Record<number, Record<number, number>> = {};
for (const q of ALL) {
  const l = levelOf(q);
  counts[q.domain] = counts[q.domain] ?? { 1: 0, 2: 0, 3: 0 };
  counts[q.domain][l]++;
}
console.log('Distribución nivel x dominio:', JSON.stringify(counts, null, 1));
const tot = { 1: 0, 2: 0, 3: 0 };
for (const d of Object.values(counts)) for (const l of [1, 2, 3] as const) tot[l] += d[l];
console.log('Totales:', JSON.stringify(tot));
