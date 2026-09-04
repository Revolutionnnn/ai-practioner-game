/* Dificultad adaptativa: clasifica cada pregunta del banco en 3 niveles,
   siempre dentro del contenido del examen (no inventa temas nuevos).
   Nv1 🌱 Recall · Nv2 ⚡ Aplicación · Nv3 🔥 Escenario / juicio */
import type { Question } from './types';

const SCENARIO =
  /(empresa|negocio|producción|despliegue|debes|deberías|recomienda|recomendarías|escenario|caso de uso|falla|error|problema|riesgo|auditor|mitiga|protege|evalúa|elige|mejor opción|preferir|prioriza|equipo necesita|cliente necesita|jefe|presupuesto|incidente)/;
const APPLICATION =
  /(cuándo|qué técnica|qué servicio|qué herramienta|qué métrica|qué método|cómo|por qué|cuál.*(usar|elegir|preferir|conviene)|ordena|secuencia|flujo|pasos|diferencia entre|distingue|compara|cuánto cost|cuanto cost)/;

/* Ajustes finos para preguntas que la heurística clasifica mal */
const OVERRIDES: Record<string, 1 | 2 | 3> = {
  'd1-25': 3, // accuracy engañoso en fraude: trampa clásica
  'd1-24': 2, // precision vs recall se confunde
  'd1-21': 2, // ML tradicional vs FM: juicio
  'd1-20': 2, // cuándo NO usar IA: juicio
  'd2-14': 2, // no-determinismo: concepto trampa
  'd2-15': 2,
  'd3-06': 2, // orden de costos
  'd3-13': 2, // injection: concepto clave pero confusable
  'd3-27': 3, // caso de filtrado: escenario
  'd3-24': 2,
  'd4-15': 3, // sesgo en crédito: escenario
  'd4-06': 2, // overfitting
  'd5-01': 2, // responsabilidad compartida se confunde
  'd5-07': 3, // defensa en capas: escenario
  'd5-09': 2,
  // Operación Profundidad: las de aplicación directa no las caza la heurística
  'd1-31': 2, 'd1-32': 2, 'd1-36': 2,
  'd2-27': 2, 'd2-28': 2, 'd2-29': 3, 'd2-30': 2,
  'd3-29': 3, 'd3-30': 3, 'd3-31': 2, 'd3-34': 3, 'd3-38': 3, 'd3-40': 3,
  'd4-17': 2, 'd4-20': 3,
  'd5-19': 2, 'd5-24': 2, 'd5-26': 2,
};

export type Level = 1 | 2 | 3;

export const LEVEL_INFO: Record<Level, { name: string; icon: string; desc: string }> = {
  1: { name: 'Fundamentos', icon: '🌱', desc: 'recuerda conceptos' },
  2: { name: 'Aplicación', icon: '⚡', desc: 'elige la herramienta correcta' },
  3: { name: 'Experto examen', icon: '🔥', desc: 'juicio en escenarios reales' },
};

export function levelOf(q: Question): Level {
  if (q.level === 1 || q.level === 2 || q.level === 3) return q.level;
  const over = OVERRIDES[q.id];
  if (over) return over;
  const t = `${q.q} ${q.options.join(' ')}`.toLowerCase();
  if (q.type === 'multi' && SCENARIO.test(t)) return 3;
  if (SCENARIO.test(t)) return 3;
  if (q.type === 'multi') return 2;
  if (APPLICATION.test(t)) return 2;
  return 1;
}

/** Cola mezclada de preguntas de un nivel (y dominio opcional) */
export function levelPool(all: Question[], level: Level, domain = 0): Question[] {
  const pool = all.filter((q) => levelOf(q) === level && (domain === 0 || q.domain === domain));
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
