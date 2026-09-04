import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ALL, QBYID, shuffledOptions } from '../data';
import type { Question } from '../data/types';
import { DOMAIN_INFO } from '../data/types';
import { LEVEL_INFO, levelOf, levelPool, type Level } from '../data/difficulty';
import { useProgress, xpForDomain } from '../store/progress';
import { SlideQ, TimerBar, boom, playSfx } from '../fx';

/* Tiempo por nivel: Nv1 ritmo rápido, Nv2 estándar, Nv3 con aire para leer escenarios */
const Q_TIME: Record<Level, number> = { 1: 30, 2: 25, 3: 35 };
const BEST_KEY = 'aifq-quiz-best';

function loadBest(): number {
  try { return parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}

/* Snapshot de batalla: nivel, vidas, score, pregunta y colas sobreviven
   a cambios de tab e incluso a recargar la página */
const SNAP_KEY = 'aifq-quiz-snap-v1';
interface Snap {
  level: Level; lives: number; score: number; answered: number;
  maxLevel: Level; fifties: number; domain: number; qId: string;
  queues: Record<Level, string[]>;
}
function loadSnap(): Snap | null {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Snap;
    if (!s || s.lives <= 0 || !QBYID[s.qId]) return null;
    return s;
  } catch { return null; }
}

export default function QuizBattle() {
  const p = useProgress();
  const [snap] = useState(loadSnap);
  const [domain, setDomain] = useState<number>(snap?.domain ?? 0);
  const [level, setLevel] = useState<Level>(snap?.level ?? 1);
  const [lives, setLives] = useState(snap?.lives ?? 3);
  const [score, setScore] = useState(snap?.score ?? 0);
  const [answered, setAnswered] = useState(snap?.answered ?? 0);
  const [q, setQ] = useState<Question>(() => (snap && QBYID[snap.qId]) || levelPool(ALL, 1)[0]);
  const [sel, setSel] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const [over, setOver] = useState(false);
  const [qTime, setQTime] = useState(Q_TIME[snap?.level ?? 1]);
  const [timeLeft, setTimeLeft] = useState(Q_TIME[snap?.level ?? 1]);
  const [fifties, setFifties] = useState(snap?.fifties ?? 1); // 1 comodín por partida: úsalo con cabeza
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [splash, setSplash] = useState<string | null>(null);
  const [maxLevel, setMaxLevel] = useState<Level>(snap?.maxLevel ?? 1);
  const [best, setBest] = useState(loadBest);
  const queues = useRef<Record<Level, Question[]>>(
    snap
      ? {
          1: snap.queues[1].map((id) => QBYID[id]).filter(Boolean),
          2: snap.queues[2].map((id) => QBYID[id]).filter(Boolean),
          3: snap.queues[3].map((id) => QBYID[id]).filter(Boolean),
        }
      : { 1: [], 2: [], 3: [] }
  );
  const timerRef = useRef<number | null>(null);
  // Espejo de preguntas ya vistas (anti-repetición entre partidas)
  const seenRef = useRef<string[]>(p.seenQuiz);
  useEffect(() => { seenRef.current = p.seenQuiz; }, [p.seenQuiz]);

  const draw = (lv: Level, dom: number): Question => {
    let queue = queues.current[lv].filter((x) => dom === 0 || x.domain === dom);
    if (queue.length === 0) {
      const poolAll = levelPool(ALL, lv, dom);
      // Anti-repetición: evita preguntas ya vistas; si se agotó el banco, reinicia el ciclo
      let fresh = poolAll.filter((qq) => !seenRef.current.includes(qq.id));
      if (fresh.length === 0) {
        p.clearSeenFor(poolAll.map((qq) => qq.id));
        fresh = poolAll;
      }
      queues.current[lv] = fresh;
      queue = fresh;
    }
    const [nextQ] = queue;
    // quitar de la cola real (puede mezclarse con otros dominios, se filtra al sacar)
    queues.current[lv] = queues.current[lv].filter((x) => x.id !== nextQ.id);
    return nextQ;
  };

  const reset = (d: number) => {
    playSfx('click');
    setDomain(d);
    queues.current = { 1: [], 2: [], 3: [] };
    setLevel(1); setLives(3); setScore(0); setAnswered(0);
    const nq = draw(1, d);
    setQ(nq); p.addSeen(nq.id); setQTime(Q_TIME[1]);
    setSel([]); setLocked(false); setOver(false);
    setTimeLeft(Q_TIME[1]); setFifties(1); setEliminated([]);
    setMaxLevel(1); setSplash(null);
  };

  /** Cambiar de dominio SIN reiniciar la partida (vidas, score y racha se conservan) */
  const changeDomain = (d: number) => {
    if (d === domain) return;
    playSfx('click');
    setDomain(d);
    queues.current = { 1: [], 2: [], 3: [] };
    const nq = draw(level, d);
    setQ(nq); p.addSeen(nq.id); setQTime(Q_TIME[level]);
    setSel([]); setLocked(false);
    setTimeLeft(Q_TIME[level]); setEliminated([]);
  };

  const flash = (text: string) => {
    setSplash(text);
    window.setTimeout(() => setSplash(null), 1400);
  };

  // Guardar snapshot de la batalla en cada cambio (sobrevive tabs y recargas)
  useEffect(() => {
    try {
      if (over) { localStorage.removeItem(SNAP_KEY); return; }
      const s: Snap = {
        level, lives, score, answered, maxLevel, fifties, domain, qId: q.id,
        queues: {
          1: queues.current[1].map((x) => x.id),
          2: queues.current[2].map((x) => x.id),
          3: queues.current[3].map((x) => x.id),
        },
      };
      localStorage.setItem(SNAP_KEY, JSON.stringify(s));
    } catch { /* noop */ }
  }, [level, lives, score, answered, maxLevel, fifties, domain, q, over]);

  // Al montar: registrar la pregunta actual como vista y avisar si se reanudó
  useEffect(() => {
    p.addSeen(q.id);
    if (snap) flash('💾 Batalla recuperada: sigues en Nv' + snap.level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer por pregunta (duración según el nivel de la pregunta actual)
  useEffect(() => {
    if (over || locked || !q) return;
    setTimeLeft(qTime);
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0.1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          fail(true);
          return 0;
        }
        if (t <= 5.1 && t > 5) playSfx('tick');
        return +(t - 0.1).toFixed(1);
      });
    }, 100);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, over, locked]);

  const fail = (timeout: boolean) => {
    setLocked(true);
    if (timeout) setAnswered((a) => a + 1);
    p.addFail(q.id);
    playSfx('wrong');
    p.addResult(false, q.domain, 0, 'quiz');
    const left = lives - 1;
    setLives(left);
    if (p.streak >= 2) flash('Racha perdida 💔');
    if (level > 1) {
      const nl = (level - 1) as Level;
      setLevel(nl);
      if (!timeout) flash(`Bajas a nivel ${nl} ${LEVEL_INFO[nl].icon}`);
    }
    if (left <= 0) {
      window.setTimeout(() => {
        setOver(true);
        setBest((b) => {
          const nb = Math.max(b, score);
          try { localStorage.setItem(BEST_KEY, String(nb)); } catch { /* noop */ }
          return nb;
        });
        if (score >= 10) { playSfx('win'); boom({ big: true }); }
      }, 900);
    }
  };

  const succeed = () => {
    setLocked(true);
    const newScore = score + 1;
    setScore(newScore);
    p.clearFail(q.id);
    p.addResult(true, q.domain, xpForDomain(q.domain) + (timeLeft > qTime / 2 ? 5 : 0), 'quiz');
    playSfx('correct');
    const newStreak = p.streak + 1;
    if (newStreak >= 3) boom();
    // Subir de nivel cada 2 aciertos seguidos
    if (newStreak > 0 && newStreak % 2 === 0 && level < 3) {
      const nl = (level + 1) as Level;
      setLevel(nl);
      setMaxLevel((m) => (Math.max(m, nl) as Level));
      playSfx('levelup');
      boom();
      flash(`¡NIVEL ${nl}! ${LEVEL_INFO[nl].icon} ${LEVEL_INFO[nl].name}`);
    } else if (newStreak === 5) { playSfx('win'); boom({ big: true }); }
  };

  const toggle = (idx: number) => {
    if (locked || over || eliminated.includes(idx)) return;
    playSfx('click');
    if (q.type === 'single') setSel([idx]);
    else setSel((s) => (s.includes(idx) ? s.filter((x) => x !== idx) : [...s, idx]));
  };

  // Opciones mezcladas (determinista por id): la correcta ya no vive en la posición 1
  const view = useMemo(() => shuffledOptions(q), [q.id]);

  const useFifty = () => {
    if (fifties <= 0 || locked || over) return;
    const wrongs = view.options.map((_, idx) => idx).filter((idx) => !view.answer.includes(idx));
    setEliminated(shuffled2(wrongs).slice(0, Math.min(2, wrongs.length)));
    setFifties((f) => f - 1);
    playSfx('pop');
  };

  const check = () => {
    if (sel.length === 0 || locked) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    const ok = sel.length === view.answer.length && sel.every((s) => view.answer.includes(s));
    setAnswered((a) => a + 1);
    if (ok) succeed();
    else fail(false);
  };

  const next = () => {
    playSfx('click');
    const nq = draw(level, domain);
    setQ(nq); p.addSeen(nq.id); setQTime(Q_TIME[level]);
    setSel([]); setLocked(false); setEliminated([]);
  };

  const isCorrect = useMemo(() => {
    if (!q || !locked) return false;
    return sel.length === view.answer.length && sel.every((s) => view.answer.includes(s));
  }, [q, locked, sel, view]);
  const combo = p.streak;
  const danger = timeLeft <= 5;
  const accuracy = answered ? Math.round((score / answered) * 100) : 100;

  if (over) {
    const record = score > best && score > 0;
    return (
      <motion.div className="card" style={{ textAlign: 'center' }} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
        <h2>⚔️ ¡Fin de la batalla!</h2>
        <motion.p style={{ fontSize: 52 }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 12 }}>
          {score >= 15 ? '🏆' : score >= 10 ? '🥈' : score >= 5 ? '🥉' : '💪'}
        </motion.p>
        <p style={{ fontSize: 20 }}><b>{score}</b> aciertos · precisión {accuracy}%</p>
        <p><span className="tag">Nivel máximo: {LEVEL_INFO[maxLevel].icon} {LEVEL_INFO[maxLevel].name}</span> <span className="tag">🏅 Récord: {Math.max(best, score)}</span> {record && <span className="tag">¡NUEVO RÉCORD! 🎉</span>}</p>
        <p className="muted">{maxLevel < 3 ? 'Aguanta rachas de 2 para subir al nivel 3, donde están las preguntas tipo examen.' : '¡Llegaste al nivel experto! Ahora al simulacro.'}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
          <button className="btn" onClick={() => reset(domain)}>Revancha 🔁</button>
          <button className="btn ghost" onClick={() => reset(0)}>Mezclar todo 🎲</button>
        </div>
      </motion.div>
    );
  }

  const qLevel = levelOf(q);

  return (
    <div className="grid cols-2">
      <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence>
          {splash && (
            <motion.div key={splash} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,7,18,.72)', backdropFilter: 'blur(3px)', fontSize: 30, fontWeight: 900, textAlign: 'center', padding: 20 }}>
              {splash}
            </motion.div>
          )}
        </AnimatePresence>
        <h2>⚔️ Quiz Battle <span className="tag">❤️ {lives}</span>
          <AnimatePresence mode="popLayout"><motion.span key={score} className="tag" initial={{ scale: 1.4 }} animate={{ scale: 1 }}>✅ {score}</motion.span></AnimatePresence>
          {combo >= 2 && <span className={`combo ${combo >= 4 ? 'hot' : ''}`}>🔥x{combo}</span>}
        </h2>
        <div style={{ display: 'flex', gap: 4, margin: '8px 0' }}>
          {([1, 2, 3] as Level[]).map((l) => (
            <div key={l} className="tag" style={{ borderColor: level === l ? '#fbbf24' : undefined, opacity: level === l ? 1 : 0.45 }}>
              {LEVEL_INFO[l].icon} Nv{l}{level === l ? ' ←' : ''}
            </div>
          ))}
          <button style={{ padding: '4px 10px', fontSize: 12, marginLeft: 'auto' }} className="btn gold" disabled={fifties <= 0 || locked} onClick={useFifty} title="Elimina 2 opciones. Solo 1 por partida.">🃏 50/50 ({fifties})</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0 10px' }}>
          <button style={{ padding: '6px 10px', fontSize: 13 }} className="btn ghost" onClick={() => changeDomain(0)}>🎲 Todo</button>
          {[1, 2, 3, 4, 5].map((d) => (
            <button key={d} style={{ padding: '6px 10px', fontSize: 13, borderColor: domain === d ? '#7c6cff' : undefined }} className="btn ghost" onClick={() => changeDomain(d)}>{DOMAIN_INFO[d].icon} D{d}</button>
          ))}
          <button style={{ padding: '6px 10px', fontSize: 13 }} className="btn ghost" onClick={() => reset(domain)} title="Reinicia vidas, score y nivel">🔄 Nueva</button>
        </div>
        <AnimatePresence mode="wait">
          <SlideQ key={q.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p><span className="tag" style={{ borderColor: DOMAIN_INFO[q.domain].color }}>D{q.domain}</span><span className="tag">{LEVEL_INFO[qLevel].icon} Nv{qLevel}</span><span className="tag">{q.type === 'single' ? '1 respuesta' : 'todas'}</span></p>
              <span className="timer">⏱️ {Math.ceil(timeLeft)}s de {qTime}s</span>
            </div>
            <TimerBar frac={timeLeft / qTime} danger={danger} />
            <h3 style={{ fontSize: 18, marginTop: 10 }}>{q.q}</h3>
            {view.options.map((op, idx) => {
              if (eliminated.includes(idx)) return <button key={idx} className="opt eliminated" disabled>🚫 {op}</button>;
              let cls = 'opt';
              if (locked) {
                if (view.answer.includes(idx)) cls += ' correct';
                else if (sel.includes(idx)) cls += ' wrong';
              } else if (sel.includes(idx)) cls += ' selected';
              return <button key={idx} className={cls} disabled={locked} onClick={() => toggle(idx)}>{op}</button>;
            })}
            {!locked
              ? <button className="btn" disabled={sel.length === 0} onClick={check}>Responder ⚡ {timeLeft > qTime / 2 ? '(+5 🚀)' : ''}</button>
              : lives > 0 && <button className="btn" onClick={next}>Siguiente →</button>}
            {locked && lives > 0 && (
              <motion.div className={`feedback ${isCorrect ? 'good' : 'bad'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {isCorrect ? `✅ ¡Correcto!${timeLeft > qTime / 2 ? ' Bonus 🚀' : ''}${combo >= 2 ? ` · combo 🔥x${combo}` : ''}` : timeLeft === 0 && sel.length === 0 ? '⏰ ¡Tiempo agotado! -1 ❤️ (va a 🩹 Mis fallos)' : '❌ Fallo. -1 ❤️, bajas un nivel y va a 🩹 Mis fallos.'}
                <br />📖 {q.explain}
              </motion.div>
            )}
          </SlideQ>
        </AnimatePresence>
      </div>
      <div className="card">
        <h3>💡 Supervivencia adaptativa</h3>
        <p className="muted">• 3 vidas ❤️. Fallo o tiempo = -1 vida, <b>bajas un nivel</b> y la pregunta va a 🩹 Mis fallos.<br />• <b>2 aciertos seguidos = subes</b>: 🌱 (30s) → ⚡ (25s) → 🔥 escenarios (35s).<br />• Cambiar de dominio (D1-D5) ya NO reinicia tu partida. 🔄 Nueva sí.<br />• Bonus +5 con más de medio tiempo. 🃏 50/50: uno solo por partida.</p>
        <h3 style={{ marginTop: 14 }}>📚 Chuleta rápida</h3>
        <p className="muted">Transcribe 🎙️→📝 · Polly 📝→🎙️ · Comprehend 😊📝 · Lex 🤖💬 · Rekognition 📷 · Personalize 🎬 · Textract 🧾 · Kendra 🔎 · Bedrock 🧠 API · SageMaker 🏋️ entrena</p>
      </div>
    </div>
  );
}

function shuffled2<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
