import { useState } from 'react';
import { AnimatePresence, Reorder, motion } from 'framer-motion';
import { ORDER_PUZZLES, shuffled } from '../data';
import { useProgress } from '../store/progress';
import { boom, playSfx } from '../fx';

export default function OrderGame() {
  const p = useProgress();
  const [pi, setPi] = useState(0);
  const puzzle = ORDER_PUZZLES[pi];
  const [order, setOrder] = useState<string[]>(() => shuffled(puzzle.steps));
  const [checked, setChecked] = useState<null | boolean>(null);
  const [solved, setSolved] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const load = (idx: number) => {
    playSfx('click');
    const n = ((idx % ORDER_PUZZLES.length) + ORDER_PUZZLES.length) % ORDER_PUZZLES.length;
    setPi(n);
    setOrder(shuffled(ORDER_PUZZLES[n].steps));
    setChecked(null);
    setAttempts(0);
  };

  const check = () => {
    const ok = order.every((s, idx) => s === puzzle.steps[idx]);
    setChecked(ok);
    setAttempts((a) => a + 1);
    p.addResult(ok, 1, ok && attempts === 0 ? 60 : 40, 'order');
    if (ok) {
      setSolved((s) => s + 1);
      playSfx('win');
      boom();
    } else playSfx('wrong');
  };

  return (
    <div className="grid cols-2">
      <div className="card">
        <h2>🧩 {puzzle.title} <span className="tag">{pi + 1}/{ORDER_PUZZLES.length}</span> <span className="tag">🏅 {solved}</span></h2>
        <p className="muted">👆 <b>Arrastra</b> los pasos para ordenarlos. Bonus +20 si lo clavas al primer intento.</p>
        <Reorder.Group axis="y" values={order} onReorder={(v) => { if (checked !== true) { setOrder(v); setChecked(null); } }}>
          <AnimatePresence>
            {order.map((s, idx) => {
              const correctPos = checked && puzzle.steps[idx] === s;
              return (
                <Reorder.Item
                  key={s}
                  value={s}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0, backgroundColor: checked ? (correctPos ? 'rgba(52,211,153,.15)' : 'rgba(248,113,113,.15)') : 'rgba(255,255,255,.05)' }}
                  whileDrag={{ scale: 1.04, boxShadow: '0 12px 30px rgba(124,108,255,.45)' }}
                  transition={{ duration: 0.2 }}
                  className="step"
                  onDragStart={() => playSfx('click')}
                >
                  <motion.span className="n" animate={{ backgroundColor: checked ? (correctPos ? '#059669' : '#dc2626') : '#7c6cff' }}>{idx + 1}</motion.span>
                  {s} <span style={{ marginLeft: 'auto' }}>⋮⋮</span>
                </Reorder.Item>
              );
            })}
          </AnimatePresence>
        </Reorder.Group>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn" onClick={check}>Comprobar ✅</button>
          <button className="btn ghost" onClick={() => load(pi + 1)}>Otro puzzle 🎲</button>
        </div>
        <AnimatePresence>
          {checked !== null && (
            <motion.div className={`feedback ${checked ? 'good' : 'bad'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {checked ? `✅ ¡Orden perfecto! ${attempts <= 1 ? '+60 XP con bonus 🌟' : '+40 XP'} · resueltos: ${solved}` : '❌ Casi. Arrastra de nuevo y reintenta.'}
              <br />📖 {puzzle.explain}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="card">
        <h3>🧠 Memotecnia</h3>
        <p className="muted"><b>ML:</b> Datos → Prepara → Entrena → Evalúa → Despliega → Monitorea.<br /><b>FM:</b> Datos → Pre-train → Fine-tune → Evalúa → Deploy → Feedback.<br /><b>RAG:</b> Chunk → Embed → Guarda → Recupera → Genera con citas.<br /><b>Agente:</b> Percibe → Recupera → Actúa → Valida → Audita.</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {ORDER_PUZZLES.map((pz, idx) => (
            <button key={pz.id} className="btn ghost" style={{ padding: '6px 10px', fontSize: 13, borderColor: idx === pi ? '#7c6cff' : undefined }} onClick={() => load(idx)}>{pz.title}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
