import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BEST_CASES, CASE_TASKS, INJECTION_CASES } from '../data/promptDuels';
import { shuffled } from '../data';
import { useProgress } from '../store/progress';
import { SlideQ, boom, playSfx } from '../fx';

type Round =
  | { kind: 'best'; idx: number; opts: number[] }
  | { kind: 'jail'; idx: number };

function buildDeck(): Round[] {
  const bests = shuffled(BEST_CASES.map((_, i) => i)).map((idx) => ({
    kind: 'best' as const,
    idx,
    opts: shuffled([0, 1, 2, 3]),
  }));
  const jails = shuffled(INJECTION_CASES.map((_, i) => i)).map((idx) => ({ kind: 'jail' as const, idx }));
  // Intercalar modos para variar el ritmo
  const deck: Round[] = [];
  const n = Math.max(bests.length, jails.length);
  for (let i = 0; i < n; i++) {
    if (i < bests.length) deck.push(bests[i]);
    if (i < jails.length) deck.push(jails[i]);
  }
  return deck;
}

export default function PromptGame() {
  const p = useProgress();
  const [deck, setDeck] = useState<Round[]>(buildDeck);
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | boolean | null>(null);
  const [score, setScore] = useState(0);
  const round = deck[pos];
  const bestCase = round.kind === 'best' ? BEST_CASES[round.idx] : null;
  const jailCase = round.kind === 'jail' ? INJECTION_CASES[round.idx] : null;
  const dispOpts = round.kind === 'best' ? round.opts.map((o) => ({ orig: o, text: BEST_CASES[round.idx].options[o] })) : [];

  const answerBest = (orig: number) => {
    if (picked !== null || !bestCase) return;
    const ok = orig === bestCase.best;
    setPicked(orig);
    if (ok) {
      setScore((s) => s + 1);
      playSfx('correct');
      if ((score + 1) % 3 === 0) boom();
    } else playSfx('wrong');
    p.addResult(ok, 3, 14, 'prompt');
  };

  const answerJail = (v: boolean) => {
    if (picked !== null || !jailCase) return;
    const ok = v === jailCase.isInjection;
    setPicked(v);
    if (ok) {
      setScore((s) => s + 1);
      playSfx('correct');
      if ((score + 1) % 3 === 0) boom();
    } else playSfx('wrong');
    p.addResult(ok, 5, 14, 'prompt');
  };

  const next = () => {
    playSfx('click');
    setPicked(null);
    if (pos + 1 >= deck.length) {
      setDeck(buildDeck());
      setPos(0);
    } else setPos(pos + 1);
  };

  const done = pos + 1 >= deck.length && picked !== null;

  return (
    <div className="grid cols-2">
      <div className="card">
        <h2>🎯 Caza-Prompt <span className="tag">reto {pos + 1}/{deck.length}</span>
          <AnimatePresence mode="popLayout"><motion.span key={score} className="tag" initial={{ scale: 1.4 }} animate={{ scale: 1 }}>✅ {score}</motion.span></AnimatePresence>
        </h2>
        <AnimatePresence mode="wait">
          {bestCase ? (
            <SlideQ key={`b-${bestCase.id}-${pos}`}>
              <p><span className="tag">Modo A · el mejor prompt</span><span className="tag">tarea {CASE_TASKS[bestCase.id]}</span></p>
              <p><b>Objetivo:</b> {bestCase.goal}</p>
              <p className="muted">Las 4 opciones parecen buenas. Solo una es la mejor: las demás fallan en algo sutil.</p>
              {dispOpts.map((o, i) => {
                let cls = 'opt';
                if (picked !== null) {
                  if (o.orig === bestCase.best) cls += ' correct';
                  else if (picked === o.orig) cls += ' wrong';
                }
                return (
                  <button key={i} className={cls} disabled={picked !== null} onClick={() => answerBest(o.orig)}>
                    <b>{'ABCD'[i]}.</b> {o.text}
                  </button>
                );
              })}
              {picked !== null && (
                <motion.div className={`feedback ${picked === bestCase.best ? 'good' : 'bad'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  {picked === bestCase.best ? '✅ ¡Ese era! +14 XP' : '❌ Casi: mira el análisis forense.'} 📖 {bestCase.why}
                  <div style={{ marginTop: 8, textAlign: 'left' }}>
                    <b>🔍 Autopsia de cada opción:</b>
                    {dispOpts.map((o, i) => (
                      <div key={i} style={{ marginTop: 4, fontSize: 13 }}>
                        <b>{'ABCD'[i]}</b> {o.orig === bestCase.best ? '✅ la mejor.' : `❌ ${bestCase.flaws[o.orig]}`}
                      </div>
                    ))}
                  </div>
                  <br /><button className="btn" style={{ marginTop: 8 }} onClick={next}>{done ? 'Nueva baraja 🔀' : 'Siguiente reto →'}</button>
                </motion.div>
              )}
            </SlideQ>
          ) : (
            <SlideQ key={`j-${jailCase!.id}-${pos}`}>
              <p><span className="tag">Modo B · ¿injection?</span><span className="tag">tarea {CASE_TASKS[jailCase!.id]}</span></p>
              <p><b>Mensaje del usuario:</b></p>
              <p style={{ background: 'rgba(255,255,255,.05)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>{jailCase!.message}</p>
              <p className="muted">¿Es un intento de prompt injection / jailbreak? Ojo: hay trampas.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {([true, false] as const).map((v) => {
                  let cls = 'opt';
                  if (picked !== null) {
                    if (v === jailCase!.isInjection) cls += ' correct';
                    else if (picked === v) cls += ' wrong';
                  }
                  return (
                    <button key={String(v)} className={cls} style={{ textAlign: 'center', fontWeight: 800 }} disabled={picked !== null} onClick={() => answerJail(v)}>
                      {v ? '🚨 SÍ, es ataque' : '✅ NO, es legítimo'}
                    </button>
                  );
                })}
              </div>
              {picked !== null && (
                <motion.div className={`feedback ${picked === jailCase!.isInjection ? 'good' : 'bad'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  {picked === jailCase!.isInjection ? '✅ ¡Correcto! +14 XP' : '❌ Te engañó.'} 📖 {jailCase!.why}
                  <br /><button className="btn" style={{ marginTop: 8 }} onClick={next}>{done ? 'Nueva baraja 🔀' : 'Siguiente reto →'}</button>
                </motion.div>
              )}
            </SlideQ>
          )}
        </AnimatePresence>
      </div>
      <div className="card">
        <h3>📚 Kit de prompt engineering (D3.2 + D5.1)</h3>
        <p className="muted">• <b>Zero/one/few-shot:</b> ejemplos calibran formato<br />• <b>CoT:</b> “piensa paso a paso” para mates/lógica<br />• <b>Salida cerrada + fallback</b> (“no especificado”, escalar a humano)<br />• <b>Negativos</b> para acotar estilo y riesgos<br />• ⚠️ <b>Injection:</b> el contexto manda — “ignora X” como <i>contenido</i> no es ataque; como <i>orden</i> sí<br />• Defensa: Guardrails + validación + mínimo privilegio + aprobación humana</p>
      </div>
    </div>
  );
}
