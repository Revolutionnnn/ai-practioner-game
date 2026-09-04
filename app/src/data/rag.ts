/* Datos del RAG Lab: antes estaban inline en games/RagLab.tsx.
   BASE_RAG_QUIZ = set manual original; GENERATED_RAG_QUIZ viene del banco D2/D3. */
import { GENERATED_RAG_QUIZ } from './generated/rag';

export const DB_INFO: Record<string, string> = {
  OpenSearch: 'Búsqueda vectorial + texto. El clásico para RAG en AWS.',
  Aurora: 'Postgres con pgvector. Ideal si ya usas Aurora.',
  Neptune: 'Grafos + vectores. Relaciones + similitud.',
  'RDS PostgreSQL': 'pgvector autogestionado. Flexible y barato.',
};

export interface RagQuizItem { id: string; q: string; opts: string[]; a: number }

export const BASE_RAG_QUIZ: RagQuizItem[] = [
  { id: 'q1', q: 'Tu asistente inventa políticas internas. ¿Solución más barata y rápida?', opts: ['Pre-entrenar desde cero', 'RAG con tus documentos + citas', 'Comprar más GPUs'], a: 1 },
  { id: 'q2', q: '¿Dónde guardas los embeddings?', opts: ['En un .txt suelto', 'Vector DB: OpenSearch / Aurora / Neptune / RDS pgvector', 'En la memoria del navegador'], a: 1 },
  { id: 'q3', q: '¿Qué temperatura para un bot factual con RAG?', opts: ['1.5 (máxima creatividad)', '0.1-0.3 (determinista y fiel)', 'No importa'], a: 1 },
];

export const RAG_QUIZ: RagQuizItem[] = [...BASE_RAG_QUIZ, ...GENERATED_RAG_QUIZ];
