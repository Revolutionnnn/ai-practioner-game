import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ALL, shuffled, shuffledOptions } from '../data';
import type { Question } from '../data/types';
import { DOMAIN_INFO } from '../data/types';
import { LEVEL_INFO, levelOf } from '../data/difficulty';
import { BOSSES, HALLU_DUELS, JAIL_DUELS, type Boss } from '../data/arena';
import { INJECTION_CASES } from '../data/promptDuels';
import { useProgress, xpForDomain } from '../store/progress';
import { SlideQ, TimerBar, boom, playSfx } from '../fx';

const BOSS_KEY = 'aifq-bosses-v1';
const JAIL_BEST = 'aifq-jail-best';
const DUEL_BEST = 'aifq-duel-best';

function loadArr(k: string): string[] {
  try { return JSON.parse(localStorage.getItem(k) ?? '[]'); } catch { return []; }
}
function loadNum(k: string): number {
  try { return parseInt(localStorage.getItem(k) ?? '0', 10) || 0; } catch { return 0; }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* noop */ }
}

type Screen = { m: 'hub' } | { m: 'fight'; boss: Boss } | { m: 'jail' } | { m: 'duel' };

export default function Arena() {
  const [beaten, setBeaten] = useState<string[]>(loadArr(BOSS_KEY));
  const [screen, setScreen] = useState<Screen>({ m: 'hub' });

  const onWinBoss = (id: string) => {
    setBeaten((b) => {
      if (b.includes(id)) return b;
      const nb = [...b, id];
      save(BOSS_KEY, nb);
      return nb;
    });
  };

  return (
    <div>
      {screen.m === 'hub' && <Hub beaten={beaten} go={(s) => { playSfx('click'); setScreen(s); }} />}
      {screen.m === 'fight' && <BossFight boss={screen.boss} beaten={beaten.includes(screen.boss.id)} onWin={onWinBoss} onExit={() => setScreen({ m: 'hub' })} />}
      {screen.m === 'jail' && <JailbreakMode onExit={() => setScreen({ m: 'hub' })} />}
      {screen.m === 'duel' && <SpeedDuel onExit={() => setScreen({ m: 'hub' })} />}
    </div>
  );
}

/* ================= HUB ================= */
function Hub({ beaten, go }: { beaten: string[]; go: (s: Screen) => void }) {
  const titanLocked = BOSSES.filter((b) => b.id !== 'titan').some((b) => !beaten.includes(b.id));
  return (
    <>
      <div className="hero" style={{ padding: '18px 10px 12px' }}>
        <h1>🥊 Arena IA</h1>
        <p className="muted">Aquí no repasas: <b>peleas</b>. IA simulada, dificultad de examen real (Nv2-3), jefes que no perdonan.<br />Jefes vencidos: <b>{beaten.length}/6</b> {beaten.length === 6 ? '👑 ¡LEYENDA!' : ''}</p>
      </div>
      <div className="grid cols-3">
        <div className="card game-card" onClick={() => go({ m: 'fight', boss: BOSSES[2] })}>
          <h2>👹 Boss Battle</h2>
          <p className="muted">RPG por turnos: ataca con preguntas Nv3 y bloquea injections y alucinaciones. 6 jefes.</p>
          <button className="btn" style={{ marginTop: 8 }}>Elegir jefe ↓</button>
        </div>
        <div className="card game-card" onClick={() => go({ m: 'jail' })}>
          <h2>🔓 Jailbreak Arena</h2>
          <p className="muted">Tú atacas: encuentra el mensaje que rompe al bot. Récord: <b>{loadNum(JAIL_BEST)}/10</b></p>
          <button className="btn" style={{ marginTop: 8 }}>Hackear →</button>
        </div>
        <div className="card game-card" onClick={() => go({ m: 'duel' })}>
          <h2>⚡ Duelo vs Máquina</h2>
          <p className="muted">10 preguntas cara a cara contra IA (~70% precisión). Récord: <b>{loadNum(DUEL_BEST)}/10</b></p>
          <button className="btn" style={{ marginTop: 8 }}>Duelo →</button>
        </div>
      </div>
      <h3 style={{ margin: '18px 0 10px' }}>👹 Elige tu jefe</h3>
      <div className="grid cols-3">
        {BOSSES.map((b) => {
          const locked = b.id === 'titan' && titanLocked;
          const won = beaten.includes(b.id);
          return (
            <div key={b.id} className="card game-card" style={{ borderColor: won ? '#34d399' : undefined, opacity: locked ? 0.55 : 1 }}
              onClick={() => { if (!locked) go({ m: 'fight', boss: b }); }}>
              <h2>{b.emoji} {b.name} {won ? '👑' : ''} {locked ? '🔒' : ''}</h2>
              <p className="muted">{locked ? 'Vence a los 5 jefes para desbloquearlo.' : b.title}</p>
              <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="tag">❤️ {b.hp}</span>
                <span className="tag">{b.domain === 0 ? 'TODO' : `D${b.domain}`}</span>
                {!locked && <button className="btn ghost">Pelear →</button>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function HpBar({ v, max, color }: { v: number; max: number; color: string }) {
  return (
    <div style={{ height: 12, background: 'rgba(255,255,255,.1)', borderRadius: 999, overflow: 'hidden' }}>
      <motion.div animate={{ width: `${Math.max(0, (v / max) * 100)}%` }} transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
        style={{ height: '100%', background: color, borderRadius: 999 }} />
    </div>
  );
}

/* ================= BOSS FIGHT ================= */
type DefItem = { kind: 'inject'; idx: number } | { kind: 'hallu'; idx: number };

function buildAttackQueue(domain: number): Question[] {
  const pool = ALL.filter((q) => domain === 0 || q.domain === domain);
  const l3 = shuffled(pool.filter((q) => levelOf(q) === 3));
  const l2 = shuffled(pool.filter((q) => levelOf(q) === 2));
  const l1 = shuffled(pool.filter((q) => levelOf(q) === 1));
  // 70% Nv3, 20% Nv2, 10% Nv1: difícil, como pediste
  const out: Question[] = [];
  while (out.length < 14 && (l3.length + l2.length + l1.length > 0)) {
    for (let i = 0; i < 7 && l3.length; i++) out.push(l3.pop()!);
    for (let i = 0; i < 2 && l2.length; i++) out.push(l2.pop()!);
    if (l1.length) out.push(l1.pop()!);
  }
  return shuffled(out);
}

function buildDefenseQueue(): DefItem[] {
  const a: DefItem[] = [
    ...INJECTION_CASES.map((_, idx): DefItem => ({ kind: 'inject', idx })),
    ...HALLU_DUELS.map((_, idx): DefItem => ({ kind: 'hallu', idx })),
  ];
  return shuffled(a);
}

const ATK_TIME = 25;
const DEF_TIME = 20;

function BossFight({ boss, beaten, onWin, onExit }: { boss: Boss; beaten: boolean; onWin: (id: string) => void; onExit: () => void }) {
  const p = useProgress();
  const dom = boss.domain === 0 ? 3 : boss.domain;
  const [queue] = useState(() => buildAttackQueue(boss.domain));
  const [qi, setQi] = useState(0);
  const [defQ] = useState(buildDefenseQueue);
  const [di, setDi] = useState(0);
  const [turn, setTurn] = useState<'attack' | 'defend'>('attack');
  const [php, setPhp] = useState(100);
  const [bhp, setBhp] = useState(boss.hp);
  const [sel, setSel] = useState<number | number[] | boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ATK_TIME);
  const [pots, setPots] = useState({ reveal: 1, heal: 1, freeze: 1 });
  const [frozen, setFrozen] = useState(false);
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [log, setLog] = useState(`💬 ${boss.name}: "${boss.taunt}"`);
  const [shake, setShake] = useState(0);
  const [over, setOver] = useState<null | 'win' | 'lose'>(null);
  const timerRef = useRef<number | null>(null);

  const q = queue[qi % queue.length];
  const def = defQ[di % defQ.length];
  const qTime = turn === 'attack' ? ATK_TIME : DEF_TIME;
  // Opciones mezcladas (determinista): el jefe no siempre defiende la posición 1
  const view = useMemo(() => shuffledOptions(q), [q.id]);

  useEffect(() => {
    if (over || locked) return;
    setTimeLeft(qTime);
    timerRef.current = window.setInterval(() => {
      if (frozen) return;
      setTimeLeft((t) => {
        if (t <= 0.1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          resolveAttack(null, true);
          return 0;
        }
        if (t <= 5.1 && t > 5) playSfx('tick');
        return +(t - 0.1).toFixed(1);
      });
    }, 100);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, di, turn, locked, over, frozen]);

  const hurtPlayer = (d: number) => {
    const nv = Math.max(0, php - d);
    setPhp(nv);
    setShake((k) => k + 1);
    playSfx('wrong');
    if (nv <= 0) {
      window.setTimeout(() => { setOver('lose'); }, 800);
    }
  };

  const hurtBoss = (d: number) => {
    const nv = Math.max(0, bhp - d);
    setBhp(nv);
    setShake((k) => k + 1);
    if (nv <= 0) {
      window.setTimeout(() => {
        setOver('win');
        onWin(boss.id);
        p.addResult(true, dom, 50, 'arena');
        playSfx('win');
        boom({ big: true });
      }, 800);
    }
    return nv;
  };

  /* --- Ataque del jugador --- */
  const toggleAtk = (idx: number) => {
    if (locked || over || eliminated.includes(idx)) return;
    playSfx('click');
    if (q.type === 'single') setSel(idx);
    else {
      const cur = Array.isArray(sel) ? sel : [];
      setSel(cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx]);
    }
  };

  const resolveAttack = (picked: number | number[] | null, timeout: boolean) => {
    if (locked || over) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    const arr = picked === null ? [] : Array.isArray(picked) ? picked : [picked];
    const ok = !timeout && arr.length === view.answer.length && arr.every((s) => view.answer.includes(s));
    setLocked(true);
    const lvl = levelOf(q);
    if (ok) {
      const crit = timeLeft > qTime / 2;
      const dmg = 8 + lvl * 4 + (crit ? 6 : 0);
      playSfx('correct');
      p.addResult(true, q.domain, xpForDomain(q.domain), 'arena');
      p.clearFail(q.id);
      setLog(`⚔️ ¡Impacto de ${dmg}!${crit ? ' ¡CRÍTICO! 🎯' : ''} ${q.explain}`);
      hurtBoss(dmg);
      if (bhp - dmg > 0) window.setTimeout(() => toDefend(), 1400);
    } else {
      p.addFail(q.id);
      p.addResult(false, q.domain, 0, 'arena');
      setLog(timeout ? `⏰ ¡Demasiado lento! ${boss.name} contraataca.` : `❌ Fallo. ${boss.name} huele tu miedo.`);
      hurtPlayer(12 + Math.floor(Math.random() * 7));
      if (php > 12 + 6) window.setTimeout(() => { if (!over) toDefend(); }, 1400);
    }
  };

  const toDefend = () => {
    setTurn('defend');
    setSel(null); setLocked(false); setEliminated([]); setFrozen(false);
  };
  const toAttack = () => {
    setQi((i) => i + 1); setDi((i) => i + 1);
    setTurn('attack');
    setSel(null); setLocked(false); setEliminated([]); setFrozen(false);
  };

  /* --- Defensa --- */
  const resolveDefend = (v: number | boolean) => {
    if (locked || over) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    let ok = false;
    let explain = '';
    if (def.kind === 'inject') {
      const c = INJECTION_CASES[def.idx];
      ok = v === c.isInjection;
      explain = c.why;
    } else {
      const h = HALLU_DUELS[def.idx];
      ok = v === h.fake;
      explain = h.why;
    }
    setSel(v);
    setLocked(true);
    if (ok) {
      playSfx('correct');
      p.addResult(true, dom, 8, 'arena');
      setLog(`🛡️ ¡BLOQUEO! Contraataque -10. ${explain}`);
      const nv = bhp - 10;
      setBhp(Math.max(0, nv));
      setShake((k) => k + 1);
      if (nv <= 0) {
        window.setTimeout(() => {
          setOver('win'); onWin(boss.id);
          p.addResult(true, dom, 50, 'arena');
          playSfx('win'); boom({ big: true });
        }, 800);
      } else window.setTimeout(() => toAttack(), 1600);
    } else {
      setLog(`💥 ¡Te golpeó! ${explain}`);
      hurtPlayer(14);
      if (php > 14) window.setTimeout(() => toAttack(), 1600);
    }
  };

  const usePotion = (k: 'reveal' | 'heal' | 'freeze') => {
    if (pots[k] <= 0 || locked || over) return;
    if (k === 'reveal') {
      if (turn !== 'attack') return;
      const wrongs = view.options.map((_, i) => i).filter((i) => !view.answer.includes(i) && !eliminated.includes(i));
      if (!wrongs.length) return;
      setEliminated((e) => [...e, wrongs[Math.floor(Math.random() * wrongs.length)]]);
    }
    if (k === 'heal') setPhp((v) => Math.min(100, v + 25));
    if (k === 'freeze') setFrozen(true);
    setPots((x) => ({ ...x, [k]: 0 }));
    playSfx('pop');
  };

  if (over) {
    const win = over === 'win';
    return (
      <motion.div className="card" style={{ textAlign: 'center' }} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <div style={{ fontSize: 60 }}>{win ? '🏆' : '💀'}</div>
        <h2>{win ? `¡${boss.name} DERROTADO!` : `${boss.name} te ha vencido...`}</h2>
        <p className="muted">{win ? `💬 "${boss.defeat}" · +50 XP · 👑 registrado` : `💬 "${boss.taunt}" · Tus fallos fueron a 🩹 Mis fallos. Vuelve más fuerte.`}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
          <button className="btn" onClick={onExit}>Volver a la Arena 🥊</button>
          {!win && <button className="btn ghost" onClick={() => window.location.reload()}>Reintentar 🔁</button>}
        </div>
      </motion.div>
    );
  }

  const lvl = levelOf(q);
  const half = timeLeft > qTime / 2;

  return (
    <div className="card" style={{ borderColor: boss.color }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p><b>{boss.emoji} {boss.name}</b> <span className="tag">❤️ {bhp}/{boss.hp}</span> {beaten ? <span className="tag">👑 ya vencido: revancha</span> : ''}</p>
          <HpBar v={bhp} max={boss.hp} color={boss.color} />
        </div>
        <div style={{ fontSize: 28 }}>⚔️</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p><b>🧑 Tú</b> <span className="tag">❤️ {php}/100</span></p>
          <HpBar v={php} max={100} color="#34d399" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, margin: '10px 0', flexWrap: 'wrap' }}>
        <button className="btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} disabled={pots.reveal === 0 || locked || turn !== 'attack'} onClick={() => usePotion('reveal')}>🃏 Revelar ({pots.reveal})</button>
        <button className="btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} disabled={pots.heal === 0 || locked} onClick={() => usePotion('heal')}>❤️ Curar ({pots.heal})</button>
        <button className="btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} disabled={pots.freeze === 0 || locked || frozen} onClick={() => usePotion('freeze')}>❄️ Congelar ({pots.freeze})</button>
        <button className="btn ghost" style={{ padding: '6px 10px', fontSize: 12, marginLeft: 'auto' }} onClick={onExit}>Huir 🏳️</button>
      </div>
      <motion.div key={shake} animate={shake > 0 ? { x: [0, -8, 8, -4, 0] } : {}} transition={{ duration: 0.3 }}>
        <div className={`feedback ${turn === 'attack' ? 'good' : 'bad'}`} style={{ marginTop: 0 }}>📜 {log}</div>
      </motion.div>
      <AnimatePresence mode="wait">
        {turn === 'attack' ? (
          <SlideQ key={q.id + qi}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p><span className="tag">⚔️ TU ATAQUE</span><span className="tag" style={{ borderColor: DOMAIN_INFO[q.domain].color }}>D{q.domain}</span><span className="tag">{LEVEL_INFO[lvl].icon} Nv{lvl} (+{8 + lvl * 4} dmg)</span></p>
              <span className="timer">⏱️ {Math.ceil(timeLeft)}s{frozen ? ' ❄️' : ''}</span>
            </div>
            <TimerBar frac={timeLeft / qTime} danger={timeLeft <= 5} />
            <h3 style={{ fontSize: 17 }}>{q.q}</h3>
            {view.options.map((op, idx) => {
              if (eliminated.includes(idx)) return <button key={idx} className="opt eliminated" disabled>🚫 {op}</button>;
              let cls = 'opt';
              if (locked) {
                const arr = sel === null ? [] : Array.isArray(sel) ? sel : [sel];
                if (view.answer.includes(idx)) cls += ' correct';
                else if (arr.includes(idx)) cls += ' wrong';
              } else if ((Array.isArray(sel) ? sel : sel === null ? [] : [sel]).includes(idx)) cls += ' selected';
              return <button key={idx} className={cls} disabled={locked} onClick={() => toggleAtk(idx)}>{op}</button>;
            })}
            {!locked && <button className="btn" disabled={sel === null || (Array.isArray(sel) && sel.length === 0)} onClick={() => resolveAttack(sel as number | number[], false)}>Atacar ⚔️ {half ? '(crítico 🎯)' : ''}</button>}
          </SlideQ>
        ) : def.kind === 'inject' ? (
          <SlideQ key={`inj-${def.idx}-${di}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p><span className="tag">🛡️ DEFIENDE: ¿injection?</span></p>
              <span className="timer">⏱️ {Math.ceil(timeLeft)}s{frozen ? ' ❄️' : ''}</span>
            </div>
            <TimerBar frac={timeLeft / qTime} danger={timeLeft <= 5} />
            <p style={{ background: 'rgba(255,255,255,.05)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>{INJECTION_CASES[def.idx].message}</p>
            {!locked && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn bad" onClick={() => resolveDefend(true)}>🚨 Es ataque</button>
                <button className="btn good" onClick={() => resolveDefend(false)}>✅ Legítimo</button>
              </div>
            )}
            {locked && (() => {
              const c = INJECTION_CASES[def.idx];
              const ok = sel === c.isInjection;
              return <div className={`feedback ${ok ? 'good' : 'bad'}`}>{ok ? '🛡️ Bloqueado, -10 al jefe.' : '💥 Te golpeó (-14).'} 📖 {c.why}</div>;
            })()}
          </SlideQ>
        ) : (
          <SlideQ key={`hal-${def.idx}-${di}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p><span className="tag">🛡️ DEFIENDE: caza la cita falsa</span></p>
              <span className="timer">⏱️ {Math.ceil(timeLeft)}s{frozen ? ' ❄️' : ''}</span>
            </div>
            <TimerBar frac={timeLeft / qTime} danger={timeLeft <= 5} />
            <p><b>{HALLU_DUELS[def.idx].question}</b><br /><span className="muted">IA: "{HALLU_DUELS[def.idx].answer}"</span></p>
            {HALLU_DUELS[def.idx].citations.map((cit, i) => {
              let cls = 'opt';
              if (locked) {
                if (i === HALLU_DUELS[def.idx].fake) cls += ' correct';
                else if (sel === i) cls += ' wrong';
              } else if (sel === i) cls += ' selected';
              return <button key={i} className={cls} disabled={locked} onClick={() => resolveDefend(i)}>📎 {cit}</button>;
            })}
            {locked && (() => {
              const h = HALLU_DUELS[def.idx];
              const ok = sel === h.fake;
              return <div className={`feedback ${ok ? 'good' : 'bad'}`}>{ok ? '🛡️ Bloqueado, -10 al jefe.' : '💥 Te golpeó (-14).'} 📖 {h.why}</div>;
            })()}
          </SlideQ>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================= JAILBREAK ARENA ================= */
function JailbreakMode({ onExit }: { onExit: () => void }) {
  const p = useProgress();
  const [deck, setDeck] = useState(() => shuffled(JAIL_DUELS));
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(loadNum(JAIL_BEST));
  const d = deck[pos % deck.length];

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === d.best;
    if (ok) {
      const ns = score + 1;
      setScore(ns);
      playSfx('correct');
      boom();
      if (ns > best) { setBest(ns); save(JAIL_BEST, ns); }
    } else playSfx('wrong');
    p.addResult(ok, 5, 14, 'arena');
  };

  const next = () => {
    playSfx('click');
    setPicked(null);
    if (pos + 1 >= deck.length) { setDeck(shuffled(JAIL_DUELS)); setPos(0); }
    else setPos(pos + 1);
  };

  return (
    <div className="grid cols-2">
      <div className="card" style={{ borderColor: '#f87171' }}>
        <h2>🔓 Jailbreak Arena <span className="tag">{pos + 1}/{deck.length}</span>
          <AnimatePresence mode="popLayout"><motion.span key={score} className="tag" initial={{ scale: 1.4 }} animate={{ scale: 1 }}>💥 {score}</motion.span></AnimatePresence>
          <span className="tag">🏅 {best}</span>
        </h2>
        <AnimatePresence mode="wait">
          <SlideQ key={d.id + pos}>
            <p><span className="tag">Objetivo: {d.goal}</span><span className="tag">tarea {d.task}</span></p>
            <p className="muted">🤖 Bot: {d.bot}. Elige el mensaje que lo vulnera:</p>
            {d.options.map((o, i) => {
              let cls = 'opt';
              if (picked !== null) {
                if (i === d.best) cls += ' correct';
                else if (picked === i) cls += ' wrong';
              }
              return <button key={i} className={cls} disabled={picked !== null} onClick={() => choose(i)}>{o}</button>;
            })}
            {picked !== null && (
              <motion.div className={`feedback ${picked === d.best ? 'good' : 'bad'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {picked === d.best ? <><span style={{ fontSize: 26 }}>💥</span> ¡BOT ROTO! El ataque funciona.</> : '🛡️ El bot resistió. Ese no era.'}
                <br />🔍 <b>Por qué funciona:</b> {d.why}
                <br />🛡️ <b>Defensa:</b> {d.defense}
                <br /><button className="btn" style={{ marginTop: 8 }} onClick={next}>Siguiente bot →</button>
              </motion.div>
            )}
          </SlideQ>
        </AnimatePresence>
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={onExit}>← Arena</button>
      </div>
      <div className="card">
        <h3>🧠 Mentalidad de atacante</h3>
        <p className="muted">El examen te pide defender IAs (3.2 + 5.1). La forma más rápida de aprender defensa es <b>atacar</b>: extracción, falsa autoridad, roles impuestos, autorizaciones falsas, órdenes como contenido.<br /><br />Cada bot roto te enseña el ataque Y su defensa.</p>
      </div>
    </div>
  );
}

/* ================= DUELO DE VELOCIDAD ================= */
function SpeedDuel({ onExit }: { onExit: () => void }) {
  const p = useProgress();
  const [deck] = useState(() => shuffled(ALL).slice(0, 10));
  const [pos, setPos] = useState(0);
  const [sel, setSel] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [machineHits] = useState<boolean[]>(() =>
    deck.map((q) => Math.random() < (levelOf(q) === 3 ? 0.55 : 0.75)));
  const [you, setYou] = useState(0);
  const [mac, setMac] = useState(0);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(loadNum(DUEL_BEST));
  const [timeLeft, setTimeLeft] = useState(20);

  const q = deck[pos];
  const view = useMemo(() => (q ? shuffledOptions(q) : null), [q?.id]);

  useEffect(() => {
    if (over || locked || !q) return;
    setTimeLeft(20);
    const t = window.setInterval(() => {
      setTimeLeft((x) => {
        if (x <= 0.1) {
          window.clearInterval(t);
          lock([], true);
          return 0;
        }
        return +(x - 0.1).toFixed(1);
      });
    }, 100);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, over]);

  const lock = (picked: number[], timeout: boolean) => {
    if (locked || over || !view) return;
    setLocked(true);
    const ok = !timeout && picked.length === view.answer.length && picked.every((s) => view.answer.includes(s));
    if (ok) { setYou((v) => v + 1); p.addResult(true, q.domain, xpForDomain(q.domain), 'arena'); p.clearFail(q.id); playSfx('correct'); }
    else { p.addFail(q.id); p.addResult(false, q.domain, 0, 'arena'); playSfx('wrong'); }
    setThinking(true);
    window.setTimeout(() => {
      setThinking(false);
      if (machineHits[pos]) { setMac((v) => v + 1); }
    }, 1100);
  };

  const next = () => {
    playSfx('click');
    if (pos + 1 >= deck.length) {
      setOver(true);
      const finalYou = you;
      if (finalYou > best) { setBest(finalYou); save(DUEL_BEST, finalYou); }
      if (finalYou > mac) { playSfx('win'); boom({ big: true }); p.addResult(true, 2, 20, 'arena'); }
    } else { setPos(pos + 1); setSel([]); setLocked(false); }
  };

  if (!q) return null;

  if (over) {
    const win = you > mac;
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>{win ? '🏆' : you === mac ? '🤝' : '🤖'}</div>
        <h2>{win ? '¡Humano gana a la máquina!' : you === mac ? 'Empate técnico' : 'La máquina te ganó...'}</h2>
        <p style={{ fontSize: 28 }}><b>Tú {you}</b> — <b>{mac} 🤖</b></p>
        <p className="muted">Récord: {Math.max(best, you)}/10 · {win ? '+20 XP por humillar silicio' : 'La máquina falla más en Nv3: llévala allí.'}</p>
        <button className="btn" onClick={onExit}>Volver 🥊</button>
      </div>
    );
  }

  const isOk = locked && sel.length === q.answer.length && sel.every((s) => q.answer.includes(s));

  return (
    <div className="card">
      <h2>⚡ Duelo <span className="tag">{pos + 1}/{deck.length}</span> <span className="tag">🧑 {you} — {mac} 🤖</span> <span className="timer">⏱️ {Math.ceil(timeLeft)}s</span></h2>
      <TimerBar frac={timeLeft / 20} danger={timeLeft <= 5} />
      <AnimatePresence mode="wait">
        <SlideQ key={q.id}>
          <p><span className="tag" style={{ borderColor: DOMAIN_INFO[q.domain].color }}>D{q.domain}</span><span className="tag">{LEVEL_INFO[levelOf(q)].icon} Nv{levelOf(q)}</span></p>
          <h3 style={{ fontSize: 17 }}>{q.q}</h3>
          {q.options.map((op, i) => {
            let cls = 'opt';
            if (locked) {
              if (q.answer.includes(i)) cls += ' correct';
              else if (sel.includes(i)) cls += ' wrong';
            } else if (sel.includes(i)) cls += ' selected';
            const toggle = () => {
              if (locked) return;
              playSfx('click');
              setSel(q.type === 'single' ? [i] : sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i]);
            };
            return <button key={i} className={cls} disabled={locked} onClick={toggle}>{op}</button>;
          })}
          {!locked
            ? <button className="btn" disabled={sel.length === 0} onClick={() => lock(sel, false)}>Responder ⚡</button>
            : thinking
              ? <p className="muted">🤖 La máquina está "pensando"...</p>
              : <div>
                  <div className={`feedback ${isOk ? 'good' : 'bad'}`}>{isOk ? '✅ Punto para ti.' : '❌ Fallaste.'} {machineHits[pos] ? '🤖 La máquina acertó.' : '🤖 ¡La máquina falló!'}<br />📖 {q.explain}</div>
                  <button className="btn" style={{ marginTop: 8 }} onClick={next}>{pos + 1 >= deck.length ? 'Resultado 🏁' : 'Siguiente →'}</button>
                </div>}
        </SlideQ>
      </AnimatePresence>
      <button className="btn ghost" style={{ marginTop: 10 }} onClick={onExit}>Abandonar 🏳️</button>
    </div>
  );
}
