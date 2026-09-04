import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ALL, buildExamPlan, shuffled, shuffledOptions } from '../data';
import { DOMAIN_INFO } from '../data/types';
import { useProgress } from '../store/progress';
import { SlideQ, TimerBar, ConfirmDialog, boom, playSfx } from '../fx';

const PLAN: [number, number][] = buildExamPlan(65); // 65 como el examen real
const TOTAL_TIME = 90 * 60;

function buildExam() {
  const picked: typeof ALL = [];
  for (const [d, n] of PLAN) {
    const pool = shuffled(ALL.filter((q) => q.domain === d));
    picked.push(...pool.slice(0, Math.min(n, pool.length)));
  }
  return shuffled(picked);
}

export default function ExamSim() {
  const p = useProgress();
  const [exam, setExam] = useState(buildExam);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [current, setCurrent] = useState(0);
  const [time, setTime] = useState(TOTAL_TIME);
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);
  const [showDeliver, setShowDeliver] = useState(false);
  const [revFilter, setRevFilter] = useState(0);
  const [timeTotal, setTimeTotal] = useState(TOTAL_TIME);

  useEffect(() => {
    if (!started || finished) return;
    const t = setInterval(() => setTime((s) => {
      if (s <= 1) { clearInterval(t); setFinished(true); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [started, finished]);

  const q = exam[current];
  const sel = answers[q?.id] ?? [];
  // Opciones mezcladas (determinista): consistente al navegar y revisar
  const view = useMemo(() => (q ? shuffledOptions(q) : null), [q?.id]);

  const toggle = (i: number) => {
    if (finished || !q) return;
    playSfx('click');
    setAnswers((a) => {
      const prev = a[q.id] ?? [];
      const next = q.type === 'single' ? [i] : prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i];
      return { ...a, [q.id]: next };
    });
  };

  const result = useMemo(() => {
    if (!finished) return null;
    let correct = 0;
    const failed: string[] = [];
    const byD: Record<number, { ok: number; total: number }> = {};
    for (const qu of exam) {
      const s = answers[qu.id] ?? [];
      const v = shuffledOptions(qu);
      const ok = s.length === v.answer.length && s.every((x) => v.answer.includes(x));
      if (ok) correct++;
      else failed.push(qu.id);
      byD[qu.domain] = byD[qu.domain] ?? { ok: 0, total: 0 };
      byD[qu.domain].total++;
      if (ok) byD[qu.domain].ok++;
    }
    const scaled = Math.round(100 + (900 * correct) / exam.length);
    return { correct, scaled, pass: scaled >= 700, byD, failed };
  }, [finished, exam, answers]);

  useEffect(() => {
    if (result) {
      p.setExamBest(result.scaled);
      // Alimentar "Mis fallos": las falladas entran, las acertadas salen
      for (const qu of exam) {
        const s = answers[qu.id] ?? [];
        const v = shuffledOptions(qu);
        const ok = s.length === v.answer.length && s.every((x) => v.answer.includes(x));
        if (ok) p.clearFail(qu.id);
        else p.addFail(qu.id);
      }
      if (result.pass) {
        p.addResult(true, 3, 100, 'exam');
        playSfx('win');
        boom({ big: true });
      } else playSfx('wrong');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const restart = () => {
    playSfx('click');
    setExam(buildExam());
    setAnswers({}); setCurrent(0); setTime(TOTAL_TIME); setTimeTotal(TOTAL_TIME); setFinished(false); setStarted(true);
    setRevFilter(0);
  };

  /** Reintento solo con las falladas (tiempo proporcional: 90s por pregunta) */
  const retryFails = () => {
    if (!result || result.failed.length === 0) return;
    playSfx('click');
    const qs = shuffled(result.failed.map((id) => exam.find((q) => q.id === id)!).filter(Boolean));
    setExam(qs);
    setAnswers({}); setCurrent(0); setTime(qs.length * 90); setTimeTotal(qs.length * 90); setFinished(false); setStarted(true);
    setRevFilter(0);
  };

  const mm = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
  const answeredCount = Object.keys(answers).length;

  if (!started) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>🎓 Simulacro AIF-C01</h2>
        <p className="muted">65 preguntas · 90 minutos · puntaje 100-1000 · apruebas con <b>700</b>.<br />Reparto como el examen: D1 20% · D2 24% · D3 28% · D4 14% · D5 14%.<br />Sin puntaje parcial en multi-respuesta: o todas bien o nada. Las sin responder cuentan como malas.</p>
        <p className="muted">Mejor marca: <b>{p.examBest ?? '—'}</b></p>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => setStarted(true)}>Empezar examen 🚀</button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>{result.pass ? '🏆 ¡APROBADO!' : '💪 Casi, sigue entrenando'}</h2>
        <p style={{ fontSize: 52, margin: '6px 0' }}>{result.scaled}<span className="muted" style={{ fontSize: 18 }}> / 1000</span></p>
        <p><b>{result.correct}/{exam.length}</b> correctas · necesitas ~700 (≈67%)</p>
        <div style={{ textAlign: 'left', maxWidth: 520, margin: '14px auto' }}>
          {[1, 2, 3, 4, 5].map((d) => {
            const r = result.byD[d];
            if (!r) return null;
            const pct = Math.round((r.ok / r.total) * 100);
            return (
              <div key={d} className="domain-row">
                <span style={{ minWidth: 200 }}>{DOMAIN_INFO[d].icon} D{d} · {r.ok}/{r.total} ({pct}%)</span>
                <div className="bar"><div style={{ width: `${pct}%`, background: pct >= 70 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171' }} /></div>
              </div>
            );
          })}
        </div>
        <p className="muted">Modelo compensatorio: no necesitas aprobar cada dominio, solo el total. Tus falladas ya están en 🩹 Mis fallos.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={restart}>Repetir simulacro 🔁</button>
          {result.failed.length > 0 && <button className="btn gold" onClick={retryFails}>🩹 Reintentar {result.failed.length} falladas</button>}
        </div>
        <details style={{ textAlign: 'left', marginTop: 16 }}>
          <summary>📝 Revisar respuestas</summary>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
            <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, borderColor: revFilter === 0 ? '#7c6cff' : undefined }} onClick={() => setRevFilter(0)}>Todas</button>
            <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, borderColor: revFilter === -1 ? '#7c6cff' : undefined }} onClick={() => setRevFilter(-1)}>❌ Solo falladas</button>
            {[1, 2, 3, 4, 5].map((d) => (
              <button key={d} className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, borderColor: revFilter === d ? '#7c6cff' : undefined }} onClick={() => setRevFilter(d)}>D{d}</button>
            ))}
          </div>
          {exam.map((qu, i) => {
            const s = answers[qu.id] ?? [];
            const v = shuffledOptions(qu);
            const ok = s.length === v.answer.length && s.every((x) => v.answer.includes(x));
            if (revFilter === -1 && ok) return null;
            if (revFilter > 0 && qu.domain !== revFilter) return null;
            return (
              <div key={qu.id} style={{ margin: '10px 0', padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
                <p><b>{i + 1}. {ok ? '✅' : '❌'}</b> {qu.q}</p>
                <p className="muted">Tu respuesta: {s.length ? s.map((x) => v.options[x]).join(' | ') : '— sin responder —'}</p>
                {!ok && <p className="muted">Correcta: {v.answer.map((x) => v.options[x]).join(' | ')}</p>}
                <p className="muted">📖 {qu.explain}</p>
              </div>
            );
          })}
        </details>
      </div>
    );
  }

  return (
    <>
    <ConfirmDialog
      open={showDeliver}
      title="¿Entregar el examen?"
      body={`Llevas ${answeredCount}/${exam.length} respondidas. Las sin responder cuentan como malas, igual que en el examen real.`}
      confirmLabel="Sí, entregar 🏁"
      onCancel={() => setShowDeliver(false)}
      onConfirm={() => { setShowDeliver(false); setFinished(true); }}
    />
    <div className="grid cols-2">
      <div className="card">
        <h2>🎓 Pregunta {current + 1}/{exam.length} <span className="timer">⏱️ {mm}</span></h2>
        <TimerBar frac={time / timeTotal} danger={time < 600} />
        <AnimatePresence mode="wait">
          <SlideQ key={q.id}>
            <p><span className="tag" style={{ borderColor: DOMAIN_INFO[q.domain].color }}>D{q.domain}</span><span className="tag">{q.type === 'single' ? '1 respuesta' : 'varias (todas)'}</span><span className="tag">respondidas {answeredCount}/{exam.length}</span></p>
            <h3 style={{ fontSize: 17, marginTop: 10 }}>{q.q}</h3>
            {(view ? view.options : q.options).map((op, i) => (
              <button key={i} className={`opt ${sel.includes(i) ? 'selected' : ''}`} onClick={() => toggle(i)}>{op}</button>
            ))}
          </SlideQ>
        </AnimatePresence>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn ghost" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>← Anterior</button>
          <button className="btn ghost" disabled={current === exam.length - 1} onClick={() => setCurrent((c) => c + 1)}>Siguiente →</button>
          <button className="btn bad" style={{ marginLeft: 'auto' }} onClick={() => setShowDeliver(true)}>Entregar 🏁</button>
        </div>
      </div>
      <div className="card">
        <h3>🗺️ Mapa ({answeredCount}/{exam.length})</h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {exam.map((qu, i) => (
            <button
              key={qu.id}
              className="exam-map-btn"
              onClick={() => setCurrent(i)}
              style={{
                border: i === current ? '2px solid #7c6cff' : '1px solid var(--border)',
                background: answers[qu.id]?.length ? 'rgba(52,211,153,.25)' : 'var(--card2)',
              }}
            >{i + 1}</button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 10 }}>Verde = respondida. Puedes saltar y volver. Al entregar se califica como el examen real.</p>
      </div>
    </div>
    </>
  );
}
