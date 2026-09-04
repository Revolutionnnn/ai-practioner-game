import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QBYID, shuffled, shuffledOptions } from '../data';
import { DOMAIN_INFO } from '../data/types';
import { useProgress } from '../store/progress';
import { SlideQ, boom, playSfx } from '../fx';

/* 🩹 Mis fallos: repaso espaciado de lo que fallaste en Quiz y Simulacro.
   Sin vidas ni timer: aquí se aprende, no se compite. Al acertar, sale del deck. */
export default function FailsGame() {
  const p = useProgress();
  const ids = p.fails;
  const [order, setOrder] = useState<string[]>(() => shuffled(ids));
  const [pos, setPos] = useState(0);
  const [sel, setSel] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const [healed, setHealed] = useState(0);

  // Sincronizar deck si cambian los fallos desde otro juego
  const deck = useMemo(() => {
    const valid = order.filter((id) => ids.includes(id) && QBYID[id]);
    const fresh = ids.filter((id) => !order.includes(id) && QBYID[id]);
    return [...valid, ...fresh];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const reshuffle = () => {
    playSfx('click');
    setOrder(shuffled(ids));
    setPos(0); setSel([]); setLocked(false);
  };

  const qid = deck[Math.min(pos, deck.length - 1)];
  const view = useMemo(() => (qid && QBYID[qid] ? shuffledOptions(QBYID[qid]) : null), [qid]);

  if (ids.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>✨</div>
        <h2>Cerebro limpio</h2>
        <p className="muted">No tienes fallos pendientes. Falla más en el Quiz o el Simulacro<br />y aparecerán aquí para repasarlos con calma.</p>
      </div>
    );
  }

  const q = qid ? QBYID[qid] : undefined;

  if (!q || !view) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>🎉</div>
        <h2>¡Deck curado!</h2>
        <p>Repasaste {healed} fallos en esta sesión. Vuelve cuando falles más.</p>
        <button className="btn" onClick={reshuffle}>Repasar de nuevo 🔁</button>
      </div>
    );
  }

  const toggle = (idx: number) => {
    if (locked) return;
    playSfx('click');
    if (q.type === 'single') setSel([idx]);
    else setSel((s) => (s.includes(idx) ? s.filter((x) => x !== idx) : [...s, idx]));
  };

  const check = () => {
    if (sel.length === 0) return;
    const ok = sel.length === view.answer.length && sel.every((s) => view.answer.includes(s));
    setLocked(true);
    if (ok) {
      p.clearFail(q.id);
      p.addResult(true, q.domain, 5, 'fails');
      setHealed((h) => h + 1);
      playSfx('correct');
      if ((healed + 1) % 5 === 0) boom();
    } else {
      p.addResult(false, q.domain, 0, 'fails');
      playSfx('wrong');
    }
  };

  const next = () => {
    playSfx('click');
    setPos((x) => x + 1); setSel([]); setLocked(false);
  };

  const ok = locked && sel.length === view.answer.length && sel.every((s) => view.answer.includes(s));

  return (
    <div className="grid cols-2">
      <div className="card">
        <h2>🩹 Mis fallos <span className="tag">quedan {deck.length - pos}</span>
          <span className="tag">🌿 curados: {healed}</span>
        </h2>
        <p className="muted">Modo repaso: sin timer, sin vidas. Lee, piensa y cura cada fallo.</p>
        <AnimatePresence mode="wait">
          <SlideQ key={q.id + pos}>
            <p><span className="tag" style={{ borderColor: DOMAIN_INFO[q.domain].color }}>D{q.domain} · {DOMAIN_INFO[q.domain].name}</span><span className="tag">tarea {q.task}</span></p>
            <h3 style={{ fontSize: 18, marginTop: 10 }}>{q.q}</h3>
            {view.options.map((op, idx) => {
              let cls = 'opt';
              if (locked) {
                if (view.answer.includes(idx)) cls += ' correct';
                else if (sel.includes(idx)) cls += ' wrong';
              } else if (sel.includes(idx)) cls += ' selected';
              return <button key={idx} className={cls} disabled={locked} onClick={() => toggle(idx)}>{op}</button>;
            })}
            {!locked
              ? <button className="btn" disabled={sel.length === 0} onClick={check}>Comprobar 🩹</button>
              : <button className="btn" onClick={next}>{pos + 1 >= deck.length ? 'Terminar 🏁' : 'Siguiente →'}</button>}
            {locked && (
              <motion.div className={`feedback ${ok ? 'good' : 'bad'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {ok ? '✅ ¡Curado! Ya no aparecerá aquí. +5 XP' : '❌ Sigue en tu deck. Repásala bien.'}
                <br />📖 {q.explain}
              </motion.div>
            )}
          </SlideQ>
        </AnimatePresence>
      </div>
      <div className="card">
        <h3>🧠 Por qué funciona</h3>
        <p className="muted">Repasar tus propios errores (<i>retrieval practice</i>) es la técnica con más evidencia para retener. El Quiz y el Simulacro mandan aquí todo lo que fallas automáticamente.<br /><br />Regla: no salgas de esta tab hasta dejarla en 0.</p>
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={reshuffle}>Barajar 🔀</button>
      </div>
    </div>
  );
}
