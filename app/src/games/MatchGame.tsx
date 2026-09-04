import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MATCH_CARDS, MATCH_DECOYS, shuffled } from '../data';
import { useProgress } from '../store/progress';
import { TimerBar, boom, playSfx } from '../fx';

const DECOYS = [
  'Alojar un sitio web estático',
  'Enviar correos masivos',
  'Gestionar DNS de un dominio',
  'Orquestar contenedores',
  'Cola de mensajes entre micros',
  'Consultar un data warehouse',
  ...MATCH_DECOYS,
];

/* Señuelos válidos para una ronda: nunca idénticos a un caso real en juego
   (si un señuelo == use de una carta, la trampa se rompe y la ronda se atasca). */
function pickDecoys(left: { use: string }[], n: number): string[] {
  const real = new Set(left.map((c) => c.use));
  return shuffled(DECOYS.filter((d) => !real.has(d))).slice(0, n);
}

const BEST_KEY = 'aifq-match-best';
const ROUND_KEY = 'aifq-match-round-v1';

function loadBest(): number {
  try { return parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}

function loadRound(): number {
  try {
    const r = parseInt(localStorage.getItem(ROUND_KEY) ?? '1', 10);
    return r >= 1 && r <= 20 ? r : 1;
  } catch { return 1; }
}

/* Dificultad por ronda: más parejas, menos tiempo, sin pistas, con señuelos.
   Tiempos holgados: las tarjetas del banco D1-D5 tienen textos largos y hay
   que leerlas (tiempo escala con nº de parejas, suelo de 60s). */
function roundConfig(r: number) {
  const pairs = Math.min(4 + (r - 1), 7);
  return {
    pairs,
    time: Math.min(120, Math.max(60, 30 + pairs * 15 - r * 4)),
    hints: r <= 3,
    decoys: r >= 4 ? Math.min(2 + Math.floor((r - 4) / 2), 4) : 0,
  };
}

export default function MatchGame() {
  const p = useProgress();
  const [round, setRound] = useState(loadRound);
  const [board, setBoard] = useState(() => {
    const r = loadRound();
    const c = roundConfig(r);
    const l = shuffled(MATCH_CARDS).slice(0, c.pairs);
    return { left: l, right: shuffled([...l.map((x) => x.use), ...pickDecoys(l, c.decoys)]) };
  });
  const left = board.left;
  const right = board.right;
  const [selL, setSelL] = useState<string | null>(null);
  const [selR, setSelR] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [fails, setFails] = useState(0);
  const [time, setTime] = useState(() => roundConfig(loadRound()).time);
  const [shakeKey, setShakeKey] = useState(0);
  const [splash, setSplash] = useState<string | null>(null);
  const [best, setBest] = useState(loadBest);
  const [trapMsg, setTrapMsg] = useState(false);

  const cfg = roundConfig(round);

  const setupRound = (r: number) => {
    const c = roundConfig(r);
    const l = shuffled(MATCH_CARDS).slice(0, c.pairs);
    const decoyPick = pickDecoys(l, c.decoys);
    setBoard({ left: l, right: shuffled([...l.map((x) => x.use), ...decoyPick]) });
    setDone([]); setSelL(null); setSelR(null);
    setTime(c.time);
    const bits = [`Ronda ${r}`];
    if (!c.hints) bits.push('¡sin pistas! 🙈');
    if (c.decoys) bits.push(`+${c.decoys} señuelos 🪤`);
    setSplash(bits.join(' · '));
    window.setTimeout(() => setSplash(null), 1600);
  };

  const startRound = (r: number) => {
    playSfx('click');
    setRound(r);
    setFails(0);
    setupRound(r);
  };

  // Persistir la ronda: al volver a la tab sigues donde ibas, no en R1
  useEffect(() => {
    try { localStorage.setItem(ROUND_KEY, String(round)); } catch { /* noop */ }
  }, [round]);

  useEffect(() => {
    if (done.length >= left.length * 2 || time <= 0) return;
    const t = window.setInterval(() => setTime((s) => {
      if (s <= 1) { window.clearInterval(t); playSfx('wrong'); return 0; }
      if (s <= 6) playSfx('tick');
      return s - 1;
    }), 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, done, left, splash]);

  const pick = (side: 'L' | 'R', v: string) => {
    if (done.includes(v) || time <= 0 || splash) return;
    playSfx('click');
    const nl = side === 'L' ? v : selL;
    const nr = side === 'R' ? v : selR;
    setSelL(nl); setSelR(nr);
    if (nl && nr) {
      const card = left.find((c) => c.service === nl);
      const isDecoy = !left.some((c) => c.use === nr);
      if (!isDecoy && card && card.use === nr) {
        const nd = [...done, nl, nr];
        setDone(nd);
        p.addResult(true, 1, 8, 'match');
        playSfx('pop');
        setSelL(null); setSelR(null);
        if (nd.length >= left.length * 2) {
          playSfx('win'); boom();
          setBest((b) => {
            const nb = Math.max(b, round);
            try { localStorage.setItem(BEST_KEY, String(nb)); } catch { /* noop */ }
            return nb;
          });
          window.setTimeout(() => startRound(round + 1), 1500);
        }
      } else {
        setFails((f) => f + 1);
        p.addResult(false, 1, 0, 'match');
        playSfx('wrong');
        setShakeKey((k) => k + 1);
        if (isDecoy) {
          setTrapMsg(true);
          window.setTimeout(() => setTrapMsg(false), 1600);
        }
        setTimeout(() => { setSelL(null); setSelR(null); }, 450);
      }
    }
  };

  const win = done.length >= left.length * 2;
  const out = time <= 0 && !win;

  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      <AnimatePresence>
        {splash && (
          <motion.div key={splash} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,7,18,.78)', fontSize: 28, fontWeight: 900, textAlign: 'center', padding: 20 }}>
            {splash}
          </motion.div>
        )}
      </AnimatePresence>
      <h2>🔗 Match AWS <span className="tag">ronda {round}</span> <span className="tag">{cfg.pairs} parejas</span> <span className="tag">✅ {done.length / 2}/{cfg.pairs}</span> <span className="tag">❌ {fails}</span> <span className="tag">🏅 récord R{best}</span> <span className="timer">⏱️ {time}s</span></h2>
      <TimerBar frac={time / cfg.time} danger={time <= 15} />
      <p className="muted">
        {cfg.hints ? 'Toca un servicio y luego su caso de uso.' : 'Modo experto: sin pistas. '}
        {cfg.decoys > 0 && '🪤 Hay señuelos que no corresponden a ningún servicio: evítalos.'}
        {' '}Cada ronda: más parejas, menos tiempo.
      </p>
      <AnimatePresence>
        {trapMsg && (
          <motion.div className="feedback bad" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            🪤 ¡Señuelo! Ese caso de uso no es de estos servicios (piensa: ¿S3? ¿SES? ¿ECS? — fuera del examen de IA).
          </motion.div>
        )}
        {win && (
          <motion.div className="feedback good" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            🎉 ¡Ronda {round} superada en {cfg.time - time}s! Siguiente nivel...
          </motion.div>
        )}
        {out && (
          <motion.div className="feedback bad" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            ⏰ ¡Tiempo! Llevabas {done.length / 2}/{cfg.pairs} en ronda {round}.
            <button className="btn" style={{ marginLeft: 8 }} onClick={() => startRound(round)}>Reintentar 🔁</button>
            <button className="btn ghost" style={{ marginLeft: 8 }} onClick={() => startRound(1)}>Desde ronda 1 🌱</button>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div className="match-grid" style={{ marginTop: 12 }} key={shakeKey} animate={shakeKey > 0 ? { x: [0, -6, 6, -3, 0] } : {}} transition={{ duration: 0.3 }}>
        <div>
          <h3>Servicios</h3>
          <AnimatePresence>
            {left.map((c) => (
              done.includes(c.service) ? null : (
                <motion.div key={c.service} layout exit={{ opacity: 0, scale: 0.85 }} className={`match-item ${selL === c.service ? 'sel' : ''}`} onClick={() => pick('L', c.service)}>
                  <b>{c.service}</b>{cfg.hints && <><br /><span className="muted">💡 {c.hint}</span></>}
                </motion.div>
              )
            ))}
          </AnimatePresence>
        </div>
        <div>
          <h3>Casos de uso</h3>
          <AnimatePresence>
            {right.map((u) => (
              done.includes(u) ? null : (
                <motion.div key={u} layout exit={{ opacity: 0, scale: 0.85 }} className={`match-item ${selR === u ? 'sel' : ''}`} onClick={() => pick('R', u)}>{u}</motion.div>
              )
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
      <p className="muted" style={{ marginTop: 10 }}>Progresión: R1-R3 con pistas (4-6 parejas) → R4+ sin pistas y con señuelos (7 parejas, menos tiempo).</p>
    </div>
  );
}
