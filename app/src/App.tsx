import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ProgressProvider, useProgress } from './store/progress';
import { DOMAIN_INFO } from './data/types';
import { AnimatedNumber, ConfirmDialog, FadeIn, Stagger, StaggerItem, boom, playSfx, useMuted } from './fx';
import QuizBattle from './games/QuizBattle';
import MatchGame from './games/MatchGame';
import OrderGame from './games/OrderGame';
import PromptGame from './games/PromptGame';
import RagLab from './games/RagLab';
import DilemmaGame, { GuardianGame } from './games/DilemmaGame';
import FailsGame from './games/FailsGame';
import Arena from './games/Arena';
import ExamSim from './games/ExamSim';

type View = 'home' | 'quiz' | 'match' | 'order' | 'prompt' | 'rag' | 'dilemma' | 'guardian' | 'exam' | 'fails' | 'arena';

const TABS: { id: View; label: string }[] = [
  { id: 'home', label: '🏠 Inicio' },
  { id: 'quiz', label: '⚔️ Quiz Battle' },
  { id: 'fails', label: '🩹 Mis fallos' },
  { id: 'match', label: '🔗 Match AWS' },
  { id: 'order', label: '🧩 Ordena' },
  { id: 'prompt', label: '🎯 Caza-Prompt' },
  { id: 'rag', label: '🧪 RAG Lab' },
  { id: 'dilemma', label: '🤝 Dilemas' },
  { id: 'guardian', label: '🛡️ Guardián' },
  { id: 'exam', label: '🎓 Simulacro' },
  { id: 'arena', label: '🥊 Arena IA' },
];

function Shell() {
  const [view, setView] = useState<View>('home');
  const p = useProgress();
  const { muted, toggle } = useMuted();
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const prevLevel = useRef(p.level);

  // Detectar subida de nivel: fanfarria + confeti + modal
  useEffect(() => {
    if (p.level > prevLevel.current) {
      prevLevel.current = p.level;
      playSfx('levelup');
      boom({ big: true });
      setShowLevelUp(true);
    }
  }, [p.level]);

  const nextLevelXp = (p.level + 1) * 300;
  const go = (v: View) => { playSfx('click'); setView(v); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <>
      <div className="bg-orbs"><div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" /></div>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand"><span className="logo-bounce">☁️</span> AWS AI Quest <small>AIF-C01 · juegos en español</small></div>
          <div className="stats">
            <motion.span className="pill" key={p.xp} initial={{ scale: 1 }} animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 0.3 }}>
              ⭐ <b><AnimatedNumber value={p.xp} /></b> XP · {p.levelName}
            </motion.span>
            <span className={`pill ${p.streak >= 3 ? 'streak-hot' : ''}`}>🔥 racha <b>{p.streak}</b></span>
            <span className="pill">🎯 {p.accuracy}%</span>
            {p.fails.length > 0 && <button className="icon-btn" onClick={() => go('fails')} title="Repasar fallos">🩹 {p.fails.length}</button>}
            <button className="icon-btn" onClick={toggle} title="Sonido">{muted ? '🔇' : '🔊'}</button>
          </div>
        </div>
      </div>
      <div className="layout">
        <div className="nav">
          {TABS.map((t) => (
            <button key={t.id} className={view === t.id ? 'active' : ''} onClick={() => go(t.id)}>{t.label}</button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}>
            {view === 'home' && <Home go={go} />}
            {view === 'quiz' && <QuizBattle />}
            {view === 'fails' && <FailsGame />}
            {view === 'match' && <MatchGame />}
            {view === 'order' && <OrderGame />}
            {view === 'prompt' && <PromptGame />}
            {view === 'rag' && <RagLab />}
            {view === 'dilemma' && <DilemmaGame />}
            {view === 'guardian' && <GuardianGame />}
            {view === 'exam' && <ExamSim />}
            {view === 'arena' && <Arena />}
          </motion.div>
        </AnimatePresence>

        <div className="footer">
          Hecho para pasar el AIF-C01 jugando · progreso guardado en tu navegador · {p.playedGames.length}/10 juegos probados
          {' · '}<button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setShowReset(true)}>reiniciar progreso</button>
          <div className="xpbar" style={{ maxWidth: 400, margin: '10px auto 0' }}>
            <motion.div animate={{ width: `${Math.min(100, (p.xp / nextLevelXp) * 100)}%` }} transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }} />
          </div>
          <div className="muted">{p.xp} / {nextLevelXp} XP para subir de nivel</div>
        </div>
      </div>

      <ConfirmDialog
        open={showReset}
        title="¿Borrar todo el progreso?"
        body="Se perderán tu XP, rachas, récords y tu deck de fallos. Esta acción no se puede deshacer."
        confirmLabel="Sí, borrar todo 🗑️"
        onCancel={() => setShowReset(false)}
        onConfirm={() => { p.reset(); setShowReset(false); }}
      />
      <AnimatePresence>
        {showLevelUp && (
          <div className="modal-backdrop" onClick={() => setShowLevelUp(false)}>
            <motion.div className="modal" initial={{ scale: 0.7, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 56 }}>🎉</div>
              <h2 style={{ margin: '8px 0' }}>¡SUBISTE DE NIVEL!</h2>
              <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>{p.levelName}</p>
              <p className="muted">Tu cerebro cloud se expande. Sigue así.</p>
              <button className="btn gold" style={{ marginTop: 14 }} onClick={() => setShowLevelUp(false)}>¡A seguir! 🚀</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function GlowCard({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
  };
  return <div ref={ref} className="card game-card" onMouseMove={onMove} onClick={onClick}>{children}</div>;
}

function Home({ go }: { go: (v: View) => void }) {
  const p = useProgress();
  // Dominio más débil por XP: la ruta se adapta a tus datos reales
  const weakest = ([1, 2, 3, 4, 5] as const).reduce((a, b) =>
    (p.xpByDomain[String(a)] ?? 0) <= (p.xpByDomain[String(b)] ?? 0) ? a : b);
  const WEAK_GAME: Record<number, { game: View; label: string }> = {
    1: { game: 'order', label: '🧩 Ordena la tubería' },
    2: { game: 'rag', label: '🧪 RAG Lab' },
    3: { game: 'prompt', label: '🎯 Caza-Prompt' },
    4: { game: 'dilemma', label: '🤝 Dilemas responsables' },
    5: { game: 'guardian', label: '🛡️ Guardián Cloud' },
  };
  const hasData = p.xp > 20;
  const games: { id: View; icon: string; title: string; desc: string; xp: string }[] = [
    { id: 'quiz', icon: '⚔️', title: 'Quiz Battle', desc: 'Supervivencia con 3 vidas: sube de 🌱 a 🔥 con tus rachas.', xp: '+10-15 XP' },
    { id: 'fails', icon: '🩹', title: 'Mis fallos', desc: 'Repaso sin presión de todo lo que fallaste. Déjalo en 0.', xp: '+5 XP' },
    { id: 'match', icon: '🔗', title: 'Match AWS', desc: 'Rondas que se endurecen: sin pistas y con señuelos.', xp: '+8 XP' },
    { id: 'order', icon: '🧩', title: 'Ordena la tubería', desc: 'Arrastra y ordena el pipeline ML, ciclo FM y RAG.', xp: '+40 XP' },
    { id: 'prompt', icon: '🎯', title: 'Caza-Prompt', desc: 'El mejor de 4 opciones sutiles + detector de injections.', xp: '+14 XP' },
    { id: 'rag', icon: '🧪', title: 'RAG Lab', desc: 'Experimenta con embeddings, vector DB y costos.', xp: '+12 XP' },
    { id: 'dilemma', icon: '🤝', title: 'Dilemas responsables', desc: 'Sesgo, Guardrails, Clarify, Model Cards. D4.', xp: '+12 XP' },
    { id: 'guardian', icon: '🛡️', title: 'Guardián Cloud', desc: 'IAM, KMS, Macie, CloudTrail. Defiende tu nube. D5.', xp: '+12 XP' },
    { id: 'exam', icon: '🎓', title: 'Simulacro AIF-C01', desc: '65 preguntas, 90 min, 700/1000. Como el real.', xp: 'gloria 🏆' },
    { id: 'arena', icon: '🥊', title: 'Arena IA', desc: 'Boss Battle por turnos, Jailbreak y Duelo vs máquina. Difícil.', xp: '+50 👑' },
  ];
  return (
    <>
      <div className="hero">
        <FadeIn><h1>Aprende AWS AI <span>jugando</span></h1></FadeIn>
        <FadeIn delay={0.1}>
          <p className="muted">5 dominios · 115 preguntas en español · XP, combos, rachas y simulacro real.<br />Mejor marca simulacro: <b>{p.examBest ?? '—'}</b> / 1000 {p.examBest != null && p.examBest >= 700 ? '✅ ¡APTO!' : ''}</p>
        </FadeIn>
        <FadeIn delay={0.18}>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => go('quiz')}>⚔️ Batalla rápida</button>
            <button className="btn ghost" onClick={() => go('exam')}>🎓 Simulacro final</button>
          </div>
        </FadeIn>
      </div>
      <div className="grid cols-2">
        <FadeIn delay={0.05}>
          <div className="card">
            <h3>📊 Tu dominio por área (peso del examen)</h3>
            {[1, 2, 3, 4, 5].map((d) => (
              <div key={d} className="domain-row">
                <span style={{ minWidth: 190 }}>{DOMAIN_INFO[d].icon} D{d} · {DOMAIN_INFO[d].name} <span className="muted">({DOMAIN_INFO[d].weight})</span></span>
                <div className="bar">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (p.xpByDomain[String(d)] ?? 0) / 3)}%` }} transition={{ duration: 0.7, ease: [0, 0, 0.2, 1] }} style={{ background: DOMAIN_INFO[d].color }} />
                </div>
                <b>{p.xpByDomain[String(d)] ?? 0}</b>
              </div>
            ))}
            <p className="muted" style={{ marginTop: 10 }}>💡 El D3 (28%) es el que más pesa: prioriza RAG, prompts y evaluación (ROUGE/BLEU).</p>
          </div>
        </FadeIn>
        <FadeIn delay={0.12}>
          <div className="card">
            {hasData && (
              <div className="feedback good" style={{ marginBottom: 10 }}>
                🎯 Tu punto débil es <b>D{weakest} · {DOMAIN_INFO[weakest].name}</b> ({DOMAIN_INFO[weakest].weight} del examen).
                {' '}<button className="btn" style={{ marginLeft: 6, padding: '6px 12px', fontSize: 13 }} onClick={() => go(WEAK_GAME[weakest].game)}>Atacarlo: {WEAK_GAME[weakest].label} →</button>
              </div>
            )}
            <h3>🗺️ Ruta recomendada</h3>
            <p className="muted">1️⃣ Quiz Battle para calentar → 2️⃣ Match + Ordena → 3️⃣ Caza-Prompt + RAG Lab (D3, el 28%) → 4️⃣ Dilemas + Guardián → 5️⃣ Simulacro hasta 700+.</p>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => go('quiz')}>Empezar ⚔️</button>
              <button className="btn ghost" onClick={() => go('exam')}>Ir al simulacro 🎓</button>
            </div>
          </div>
        </FadeIn>
      </div>
      <Stagger gap={0.05}>
        <div className="grid cols-3" style={{ marginTop: 14 }}>
          {games.map((g) => (
            <StaggerItem key={g.id}>
              <GlowCard onClick={() => go(g.id)}>
                <h2>{g.icon} {g.title}</h2>
                <p className="muted">{g.desc}</p>
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="tag">{g.xp}</span>
                  {p.playedGames.includes(g.id) ? <span className="tag">✅ jugado</span> : null}
                  <button className="btn ghost">Jugar →</button>
                </div>
              </GlowCard>
            </StaggerItem>
          ))}
        </div>
      </Stagger>
    </>
  );
}

export default function App() {
  return (
    <ProgressProvider>
      <Shell />
    </ProgressProvider>
  );
}
