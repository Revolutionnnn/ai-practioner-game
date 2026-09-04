import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DILEMMAS, GUARDIAN_CASES } from '../data';
import { useProgress, xpForDomain } from '../store/progress';
import { SlideQ, boom, playSfx } from '../fx';

function ScenarioGame({ cases, gameId, domain, title, subtitle }: { cases: typeof DILEMMAS; gameId: string; domain: number; title: string; subtitle: string }) {
  const p = useProgress();
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const c = cases[idx % cases.length];
  const multi = (c as { multi?: boolean }).multi;

  const toggle = (i: number) => {
    if (locked) return;
    playSfx('click');
    if (multi) setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    else setSel([i]);
  };
  const check = () => {
    if (sel.length === 0) return;
    const ok = sel.length === c.answer.length && sel.every((s) => c.answer.includes(s));
    setLocked(true);
    p.addResult(ok, domain, xpForDomain(domain), gameId);
    if (ok) { setScore((s) => s + 1); playSfx('correct'); if ((score + 1) % 3 === 0) boom(); }
    else playSfx('wrong');
  };
  const next = () => { playSfx('click'); setIdx((i) => i + 1); setSel([]); setLocked(false); };
  const ok = locked && sel.length === c.answer.length && sel.every((s) => c.answer.includes(s));

  return (
    <div className="card">
      <h2>{title} <span className="tag">{(idx % cases.length) + 1}/{cases.length}</span>
        <AnimatePresence mode="popLayout"><motion.span key={score} className="tag" initial={{ scale: 1.4 }} animate={{ scale: 1 }}>✅ {score}</motion.span></AnimatePresence>
      </h2>
      <p className="muted">{subtitle}</p>
      <AnimatePresence mode="wait">
        <SlideQ key={c.id + idx}>
          <h3 style={{ marginTop: 10 }}>📌 {c.title}</h3>
          <p>{c.story}</p>
          {c.options.map((o, i) => {
            let cls = 'opt';
            if (locked) {
              if (c.answer.includes(i)) cls += ' correct';
              else if (sel.includes(i)) cls += ' wrong';
            } else if (sel.includes(i)) cls += ' selected';
            return <button key={i} className={cls} disabled={locked} onClick={() => toggle(i)}>{o}</button>;
          })}
          {!locked
            ? <button className="btn" disabled={sel.length === 0} onClick={check}>Decidir ⚖️</button>
            : <button className="btn" onClick={next}>Siguiente caso →</button>}
          {locked && <motion.div className={`feedback ${ok ? 'good' : 'bad'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>{ok ? `✅ Decisión correcta. +${xpForDomain(domain)} XP` : '❌ Esa decisión trae problemas.'}<br />📖 {c.explain}</motion.div>}
        </SlideQ>
      </AnimatePresence>
    </div>
  );
}

export function DilemmaGame() {
  return (
    <div className="grid cols-2">
      <ScenarioGame cases={DILEMMAS} gameId="dilemma" domain={4} title="🤝 Dilemas responsables" subtitle="Dominio 4 (14%): sesgo, Guardrails, Clarify, Model Cards, A2I." />
      <div className="card">
        <h3>📚 Chuleta D4</h3>
        <p className="muted">• <b>Guardrails:</b> filtra toxicidad, PII y temas<br />• <b>Clarify:</b> detecta sesgo + explica (SHAP)<br />• <b>Model Cards:</b> documenta uso, datos, límites<br />• <b>A2I:</b> humano en el loop<br />• <b>Model Monitor:</b> vigila drift en prod<br />• Overfitting = memoriza y falla afuera</p>
      </div>
    </div>
  );
}

export function GuardianGame() {
  return (
    <div className="grid cols-2">
      <ScenarioGame cases={GUARDIAN_CASES} gameId="guardian" domain={5} title="🛡️ Guardián Cloud" subtitle="Dominio 5 (14%): IAM, KMS, Macie, PrivateLink, CloudTrail, Config." />
      <div className="card">
        <h3>📚 Chuleta D5</h3>
        <p className="muted">• <b>IAM:</b> mínimo privilegio, roles por entorno<br />• <b>KMS:</b> cifrado en reposo · <b>TLS + PrivateLink:</b> en tránsito y privado<br />• <b>Macie:</b> encuentra PII en S3<br />• <b>CloudTrail:</b> quién/qué/cuándo · <b>Config:</b> ¿cumple? · <b>Audit Manager:</b> evidencia · <b>Artifact:</b> reportes SOC/ISO<br />• <b>Grounding RAG + citas:</b> anti-alucinaciones</p>
      </div>
    </div>
  );
}

export default DilemmaGame;
