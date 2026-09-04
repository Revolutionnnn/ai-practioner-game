import type { Question } from './types';
import { D1 } from './d1';
import { D2 } from './d2';
import { D3 } from './d3';
import { D4 } from './d4';
import { D5 } from './d5';
import { GENERATED_QUESTIONS } from './generated/questions';
import { GENERATED_MATCH_CARDS, GENERATED_MATCH_DECOYS } from './generated/match';
import { GENERATED_ORDER_PUZZLES } from './generated/order';
import { GENERATED_DILEMMAS, GENERATED_GUARDIANS } from './generated/scenarios';

/* Fusión: banco manual (~115) + banco externo D1-D5 (~371). IDs bank-* no colisionan. */
export const ALL: Question[] = [...D1, ...D2, ...D3, ...D4, ...D5, ...GENERATED_QUESTIONS];

/* Reparto del examen real por dominio (pesos oficiales AIF-C01).
   buildExamPlan(total) reparte con resto mayor: parametrizable si el banco cambia. */
export const EXAM_WEIGHTS: Record<number, number> = { 1: 20, 2: 24, 3: 28, 4: 14, 5: 14 };
export function buildExamPlan(total = 65): [number, number][] {
  const raw = [1, 2, 3, 4, 5].map((d) => ({ d, exact: (total * EXAM_WEIGHTS[d]) / 100 }));
  const base = raw.map(({ d, exact }) => ({ d, n: Math.floor(exact), frac: exact - Math.floor(exact) }));
  let rest = total - base.reduce((s, x) => s + x.n, 0);
  const byFrac = [...base].sort((a, b) => b.frac - a.frac);
  for (let i = 0; rest > 0; i++, rest--) byFrac[i % byFrac.length].n++;
  return base.map(({ d, n }): [number, number] => [d, n]);
}

export const byDomain = (d: number): Question[] => ALL.filter((q) => q.domain === d);

export const QBYID: Record<string, Question> = Object.fromEntries(ALL.map((q) => [q.id, q]));

export function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Mezcla DETERMINISTA de opciones por pregunta (seed = id).
   Reparte las correctas por todas las posiciones pero de forma estable:
   el repaso y la revisión muestran siempre el mismo orden. */
function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffledOptions(q: Question): { options: string[]; answer: number[] } {
  const rnd = mulberry(hashId(q.id));
  const idx = q.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return {
    options: idx.map((i) => q.options[i]),
    answer: q.answer.map((a) => idx.indexOf(a)).sort((x, y) => x - y),
  };
}

/* ---------- Datos para juego MATCH: servicio -> caso de uso ---------- */
export interface MatchCard { service: string; use: string; hint: string }
export const MATCH_CARDS: MatchCard[] = [
  { service: 'Amazon Transcribe', use: 'Voz a texto', hint: 'Subtítulos de llamadas' },  { service: 'Amazon Polly', use: 'Texto a voz', hint: 'Narración de artículos' },
  { service: 'Amazon Translate', use: 'Traducción', hint: 'ES → EN automático' },
  { service: 'Amazon Comprehend', use: 'Sentimiento y entidades', hint: 'Opinión de reseñas' },
  { service: 'Amazon Lex', use: 'Chatbots', hint: 'Bot de reservas' },
  { service: 'Amazon Rekognition', use: 'Visión: objetos y caras', hint: 'Moderación de fotos' },
  { service: 'Amazon Personalize', use: 'Recomendaciones', hint: '"Te puede gustar..."' },
  { service: 'Amazon Textract', use: 'Extraer texto de PDFs', hint: 'Facturas escaneadas' },
  { service: 'Amazon Kendra', use: 'Búsqueda empresarial', hint: 'Busca en tus docs' },
  { service: 'Amazon Bedrock', use: 'FMs vía API', hint: 'Claude/Nova serverless' },
  { service: 'SageMaker AI', use: 'Entrenar y desplegar ML', hint: 'Pipeline completo' },
  { service: 'Amazon Q', use: 'Asistente productividad', hint: 'Ayuda a programar' },
  ...GENERATED_MATCH_CARDS,
];

/** Señuelos del banco D1-D5 (opciones que sobran en los matching) */
export const MATCH_DECOYS: string[] = [...GENERATED_MATCH_DECOYS];

/* ---------- Datos para juego ORDENA ---------- */
export interface OrderPuzzle { id: string; title: string; steps: string[]; explain: string }
export const ORDER_PUZZLES: OrderPuzzle[] = [
  { id: 'ml-pipe', title: 'Pipeline ML clásico', steps: ['Recolectar datos', 'Explorar y preparar datos', 'Entrenar modelo', 'Evaluar con métricas', 'Desplegar a producción', 'Monitorear y reentrenar'], explain: 'Datos → preparar → entrenar → evaluar → deploy → monitorear (MLOps).' },
  { id: 'fm-life', title: 'Ciclo de vida de un Foundation Model', steps: ['Selección de datos', 'Pre-entrenamiento', 'Fine-tuning / alineación', 'Evaluación (ROUGE/BLEU/humana)', 'Despliegue', 'Feedback y mejora'], explain: 'El ciclo FM añade pre-train masivo + adaptación + eval continua.' },
  { id: 'rag-flow', title: 'Flujo RAG', steps: ['Dividir docs en chunks', 'Crear embeddings', 'Guardar en vector DB', 'Buscar chunks relevantes', 'Enviar contexto + pregunta al FM', 'Responder con citas'], explain: 'Chunk → embed → vector → retrieve → generate con grounding.' },
  { id: 'agent-task', title: 'Agente multi-paso (soporte)', steps: ['Recibir ticket', 'Buscar en Knowledge Base (RAG)', 'Usar herramientas (API pedido)', 'Redactar respuesta con citas', 'Pedir aprobación humana si es crítico', 'Registrar en CloudTrail'], explain: 'Agentes: percibir → recuperar → actuar → validar → auditar.' },
  ...GENERATED_ORDER_PUZZLES,
];

/* ---------- Datos DILEMA (D4) y GUARDIÁN (D5) ---------- */
export interface Scenario { id: string; title: string; story: string; options: string[]; answer: number[]; explain: string; multi?: boolean }
export const DILEMMAS: Scenario[] = [
  { id: 'e1', title: 'Currículums sesgados', story: 'Tu filtro de CV rechaza más mujeres. ¿Qué haces?', options: ['Lanzarlo, es más rápido', 'Auditar con SageMaker Clarify + análisis por subgrupos y revisión humana (A2I)', 'Borrar los logs para que nadie lo note', 'Usar un modelo más grande sin medir'], answer: [1], explain: 'Detecta, mide, mitiga y documenta. A2I mete humano en el loop.' },
  { id: 'e2', title: 'Chat tóxico', story: 'Tu bot insulta a veces. ¿Solución?', options: ['Bedrock Guardrails + filtros de toxicidad y temas denegados', 'Subir la temperatura a 1.5', 'Quitar todos los filtros', 'Publicar las conversaciones'], answer: [0], explain: 'Guardrails filtra entrada/salida: toxicidad, PII, temas.' },
  { id: 'e3', title: 'Caja negra en banca', story: 'El regulador pide explicar por qué se negó un crédito.', options: ['Decir “la IA lo decidió”', 'Model Cards + Clarify (explicabilidad) + proceso de apelación humana', 'Negar el servicio', 'Borrar el modelo'], answer: [1], explain: 'Transparencia = documentar + explicar + apelación.' },
  { id: 'e4', title: 'Dataset desbalanceado', story: 'Tus fotos de entrenamiento son 95% de una ciudad.', options: ['Entrenar igual', 'Rebalancear, documentar origen y medir por subgrupos', 'Duplicar las mismas fotos', 'Ignorarlo'], answer: [1], explain: 'Datos inclusivos y balanceados + evaluación por subgrupos.' },
  { id: 'e5', title: 'Propiedad intelectual', story: 'Tu generador crea imágenes con logos famosos.', options: ['Venderlas igual', 'Filtrar con Guardrails, citar fuentes y revisar licencias', 'Quitar la marca de agua', 'Culpar al usuario'], answer: [1], explain: 'Riesgo legal: IP + licencias + filtros.' },
  ...GENERATED_DILEMMAS,
];

export const GUARDIAN_CASES: Scenario[] = [
  { id: 'g1', title: '¿Quién invoca el modelo?', story: 'Solo el rol de la app prod debe llamar a Bedrock.', options: ['IAM con mínimo privilegio + roles por entorno', 'Clave admin en el frontend', 'Sin autenticación'], answer: [0], explain: 'Least privilege: solo invocar modelo, solo ese recurso.' },
  { id: 'g2', title: 'PII en el lago de datos', story: 'Vas a entrenar con S3 que puede tener CURPs y tarjetas.', options: ['Pasar Macie para detectar PII, cifrar con KMS y tokenizar', 'Entrenar directo sin revisar', 'Hacer público el bucket'], answer: [0], explain: 'Macie descubre PII. KMS cifra. Tokeniza antes de entrenar.' },
  { id: 'g3', title: 'Tráfico sensible', story: 'Las llamadas a Bedrock no deben ir por internet.', options: ['AWS PrivateLink (endpoint privado VPC)', 'WiFi del café', 'HTTP sin TLS'], answer: [0], explain: 'PrivateLink = tráfico privado + cifrado en tránsito.' },
  { id: 'g4', title: 'Auditoría sorpresa', story: '¿Quién llamó a qué modelo y cuándo? ¿Cumplimos cifrado?', options: ['CloudTrail (quién/qué/cuándo) + Config (¿cumple reglas?) + Artifact (reportes)', 'Preguntar por WhatsApp', 'No guardar nada'], answer: [0], explain: 'Trail audita, Config verifica, Audit Manager evidencia, Artifact reportes.' },
  { id: 'g5', title: 'Alucinación médica', story: 'Tu asistente inventa dosis.', options: ['RAG con grounding + citas + validación + score de confianza y escalado humano', 'Subir temperatura', 'Quitar las fuentes'], answer: [0], explain: 'Grounding + validación + confianza + humano para temas críticos.' },
  { id: 'g6', title: 'Agente con demasiados permisos', story: 'Tu agente lee S3, borra pedidos y crea usuarios.', options: ['AgentCore Identity + políticas por herramienta (mínimo privilegio)', 'Darle admin “por si acaso”', 'Sin identidad'], answer: [0], explain: 'Cada agente con identidad y permisos acotados por herramienta.' },
  ...GENERATED_GUARDIANS,
];
