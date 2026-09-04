export type QType = 'single' | 'multi';

export interface Question {
  id: string;
  domain: 1 | 2 | 3 | 4 | 5;
  task: string;
  type: QType;
  q: string;
  options: string[];
  answer: number[];
  explain: string;
  /** Nivel explícito del banco externo (1=básico, 2=intermedio, 3=avanzado).
      Si está presente, levelOf() lo respeta; si no, cae a la heurística. */
  level?: 1 | 2 | 3;
}

export const DOMAIN_INFO: Record<number, { name: string; weight: string; color: string; icon: string }> = {
  1: { name: 'Fundamentos IA/ML', weight: '20%', color: '#38bdf8', icon: '🧠' },
  2: { name: 'GenAI', weight: '24%', color: '#a78bfa', icon: '✨' },
  3: { name: 'Modelos Fundacionales', weight: '28%', color: '#fb923c', icon: '🏗️' },
  4: { name: 'IA Responsable', weight: '14%', color: '#4ade80', icon: '🤝' },
  5: { name: 'Seguridad y Gobernanza', weight: '14%', color: '#f87171', icon: '🛡️' },
};
