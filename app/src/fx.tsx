/* Efectos compartidos: sonido WebAudio (0KB assets), confeti y animaciones.
   Sigue skill ui-animation: GPU-only (transform/opacity), duraciones con propósito. */
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/* ---------- Sonido: mini-sintetizador WebAudio ---------- */
type SfxName = 'click' | 'correct' | 'wrong' | 'win' | 'levelup' | 'tick' | 'pop';

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.14) {
  const ac = audio();
  if (!ac || muted()) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = ac.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const MUTE_KEY = 'aifq-muted';
function muted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function playSfx(name: SfxName) {
  switch (name) {
    case 'click': tone(520, 0, 0.08, 'triangle', 0.08); break;
    case 'pop': tone(700, 0, 0.09, 'sine', 0.1); tone(1050, 0.05, 0.1, 'sine', 0.08); break;
    case 'correct': tone(523, 0, 0.12); tone(659, 0.09, 0.12); tone(784, 0.18, 0.2); break;
    case 'wrong': tone(220, 0, 0.22, 'sawtooth', 0.07); tone(155, 0.1, 0.28, 'sawtooth', 0.06); break;
    case 'tick': tone(880, 0, 0.05, 'square', 0.04); break;
    case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.18)); break;
    case 'levelup': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.12)); break;
  }
}

export function useMuted() {
  const [m, setM] = useState(muted);
  const toggle = useCallback(() => {
    setM((v) => {
      try { localStorage.setItem(MUTE_KEY, v ? '0' : '1'); } catch { /* noop */ }
      return !v;
    });
  }, []);
  return { muted: m, toggle };
}

/* ---------- Confeti ---------- */
export function boom(opts?: { big?: boolean }) {
  const base = { disableForReducedMotion: true } as const;
  if (opts?.big) {
    confetti({ ...base, particleCount: 160, spread: 100, origin: { y: 0.6 } });
    setTimeout(() => confetti({ ...base, particleCount: 90, angle: 60, spread: 60, origin: { x: 0 } }), 200);
    setTimeout(() => confetti({ ...base, particleCount: 90, angle: 120, spread: 60, origin: { x: 1 } }), 350);
  } else {
    confetti({ ...base, particleCount: 70, spread: 75, origin: { y: 0.7 } });
  }
}

/* ---------- Componentes motion reutilizables ---------- */
export const EASE_OUT = [0, 0, 0.2, 1] as const;
export const EASE_SPRING = [0.34, 1.56, 0.64, 1] as const;

export function FadeIn({ children, delay = 0, y = 18 }: { children: ReactNode; delay?: number; y?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay, ease: EASE_OUT }}>
      {children}
    </motion.div>
  );
}

export function Stagger({ children, gap = 0.06 }: { children: ReactNode; gap?: number }) {
  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } } }}>
      {children}
    </motion.div>
  );
}

/** Transición entre pantallas/preguntas (skill: slide 300ms ease-out) */
export function SlideQ({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 46 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -46 }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** Barra de tiempo animada */
export function TimerBar({ frac, danger }: { frac: number; danger: boolean }) {
  return (
    <div className={`timerbar ${danger ? 'danger' : ''}`}>
      <motion.div animate={{ scaleX: frac }} initial={false} transition={{ duration: 0.2, ease: 'linear' }} style={{ width: '100%', transformOrigin: 'left' }} />
    </div>
  );
}

/** Modal de confirmación propio (nada de confirm() nativo) */
export function ConfirmDialog({ open, title, body, confirmLabel, onCancel, onConfirm }: {
  open: boolean; title: string; body: string; confirmLabel: string;
  onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="modal-backdrop" onClick={onCancel}>
          <motion.div className="modal" style={{ borderColor: 'rgba(248,113,113,.5)', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}
            initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 26 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 8px' }}>{title}</h2>
            <p className="muted">{body}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button className="btn ghost" onClick={onCancel}>Cancelar</button>
              <button className="btn bad" onClick={() => { playSfx('click'); onConfirm(); }}>{confirmLabel}</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Número animado (para XP) */
export function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;
    const t0 = performance.now();
    const dur = 500;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setDisplay(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
      else prev.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}
