import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface ProgressState {
  xp: number;
  xpByDomain: Record<string, number>;
  answered: number;
  correct: number;
  streak: number;
  bestStreak: number;
  playedGames: string[];
  examBest: number | null;
  fails: string[];
  seenQuiz: string[];
}

const KEY = 'aif-c01-progress-v1';

const initial: ProgressState = { xp: 0, xpByDomain: {}, answered: 0, correct: 0, streak: 0, bestStreak: 0, playedGames: [], examBest: null, fails: [], seenQuiz: [] };

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initial, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return initial;
}

interface Ctx extends ProgressState {
  level: number;
  levelName: string;
  accuracy: number;
  addResult: (correct: boolean, domain?: number, baseXp?: number, game?: string) => void;
  addFail: (id: string) => void;
  clearFail: (id: string) => void;
  addSeen: (id: string) => void;
  clearSeenFor: (ids: string[]) => void;
  setExamBest: (score: number) => void;
  reset: () => void;
}

const ProgressCtx = createContext<Ctx | null>(null);

const LEVELS = ['Novato Cloud', 'Aprendiz IA', 'Constructor ML', 'Invocador Bedrock', 'Arquitecto GenAI', 'AI Practitioner 🏆'];

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<ProgressState>(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, [s]);

  const addResult: Ctx['addResult'] = (correct, domain, baseXp = 10, game) => {
    setS((p) => {
      // XP limpio: solo base por dominio. La racha se premia con combos en cada juego, no con XP inflado.
      const gain = correct ? baseXp : 0;
      const xpByDomain = { ...p.xpByDomain };
      if (correct && domain) xpByDomain[String(domain)] = (xpByDomain[String(domain)] ?? 0) + gain;
      const streak = correct ? p.streak + 1 : 0;
      const playedGames = game && !p.playedGames.includes(game) ? [...p.playedGames, game] : p.playedGames;
      return {
        ...p,
        xp: p.xp + gain,
        xpByDomain,
        answered: p.answered + 1,
        correct: p.correct + (correct ? 1 : 0),
        streak,
        bestStreak: Math.max(p.bestStreak, streak),
        playedGames,
      };
    });
  };

  const setExamBest = (score: number) => setS((p) => ({ ...p, examBest: Math.max(p.examBest ?? 0, score) }));
  const addFail = (id: string) => setS((p) => (p.fails.includes(id) ? p : { ...p, fails: [...p.fails, id] }));
  const clearFail = (id: string) => setS((p) => (p.fails.includes(id) ? { ...p, fails: p.fails.filter((f) => f !== id) } : p));
  const addSeen = (id: string) => setS((p) => (p.seenQuiz.includes(id) ? p : { ...p, seenQuiz: [...p.seenQuiz, id] }));
  const clearSeenFor = (ids: string[]) => setS((p) => {
    const drop = new Set(ids);
    const seenQuiz = p.seenQuiz.filter((id) => !drop.has(id));
    return seenQuiz.length === p.seenQuiz.length ? p : { ...p, seenQuiz };
  });
  const reset = () => setS(initial);

  const value = useMemo<Ctx>(() => {
    const level = Math.min(Math.floor(s.xp / 300), LEVELS.length - 1);
    return {
      ...s,
      level,
      levelName: LEVELS[level],
      accuracy: s.answered ? Math.round((s.correct / s.answered) * 100) : 0,
      addResult, addFail, clearFail, addSeen, clearSeenFor, setExamBest, reset,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);

  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}

export function useProgress(): Ctx {
  const c = useContext(ProgressCtx);
  if (!c) throw new Error('useProgress fuera del provider');
  return c;
}

export function xpForDomain(d: number): number {
  // D3 pesa más, como en el examen real (28%)
  return d === 3 ? 15 : d === 2 ? 13 : d === 1 ? 11 : 9;
}
