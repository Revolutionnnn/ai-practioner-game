import { useState } from 'react';
import { motion } from 'framer-motion';
import { useProgress } from '../store/progress';
import { playSfx } from '../fx';
import { DB_INFO, RAG_QUIZ } from '../data/rag';

export default function RagLab() {
  const p = useProgress();
  const [tokensIn, setTokensIn] = useState(4000);
  const [tokensOut, setTokensOut] = useState(500);
  const [priceIn, setPriceIn] = useState(0.003);
  const [priceOut, setPriceOut] = useState(0.015);
  const [db, setDb] = useState('OpenSearch');
  const [chunk, setChunk] = useState(512);
  const [k, setK] = useState(3);
  const [temp, setTemp] = useState(0.2);
  const [quizDone, setQuizDone] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const cost = (tokensIn / 1000) * priceIn + (tokensOut / 1000) * priceOut;
  // El contexto RAG también cuesta: k chunks recuperados entran al prompt
  const ctxTokens = k * chunk;
  const ctxCost = (ctxTokens / 1000) * priceIn;
  const total = cost + ctxCost;
  const warnings: string[] = [];
  if (chunk > 1024) warnings.push('⚠️ Chunks gigantes: meten ruido, empeoran la precisión y devoran contexto.');
  if (chunk < 256) warnings.push('⚠️ Chunks enanos: fragmentan el contexto y el modelo pierde el hilo.');
  if (k > 5) warnings.push('⚠️ Recuperar demasiados chunks diluye lo relevante (y pagas cada token).');
  if (temp > 0.7) warnings.push('⚠️ Temp alta + bot factual = alucinaciones aunque uses RAG.');
  if (warnings.length === 0) warnings.push('✅ Configuración sensata para RAG factual: chunks medios, pocos, temp baja.');

  const QUIZ = RAG_QUIZ;

  const checkQuiz = () => {
    const ok = QUIZ.every((q) => answers[q.id] === q.a);
    setQuizDone(true);
    p.addResult(ok, 3, 12, 'rag');
    if (ok) { playSfx('win'); } else playSfx('wrong');
  };

  const retryQuiz = () => {
    playSfx('click');
    setAnswers({});
    setQuizDone(false);
  };

  return (
    <div className="grid cols-2">
      <div className="card">
        <h2>🧪 RAG Lab</h2>
        <p className="muted">Experimenta como en el examen D3: contexto, tokens y vector DB.</p>
        <h3 style={{ marginTop: 12 }}>💰 Calculadora de costo por inferencia</h3>
        <label className="muted">Tokens entrada: <b>{tokensIn.toLocaleString()}</b></label>
        <input type="range" min={100} max={100000} step={100} value={tokensIn} onChange={(e) => setTokensIn(+e.target.value)} />
        <label className="muted">Tokens salida: <b>{tokensOut.toLocaleString()}</b></label>
        <input type="range" min={50} max={8000} step={50} value={tokensOut} onChange={(e) => setTokensOut(+e.target.value)} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <label className="muted">$ / 1K in<input type="text" value={priceIn} onChange={(e) => setPriceIn(parseFloat(e.target.value) || 0)} /></label>
          <label className="muted">$ / 1K out<input type="text" value={priceOut} onChange={(e) => setPriceOut(parseFloat(e.target.value) || 0)} /></label>
        </div>
        <motion.div className="feedback good" style={{ marginTop: 10 }} key={cost.toFixed(4)} initial={{ scale: 0.97 }} animate={{ scale: 1 }}>💵 Costo estimado: <b>${cost.toFixed(4)}</b> por llamada · <b>${(cost * 10000).toFixed(2)}</b> por 10K llamadas<br /><span className="muted">Lección del examen: entradas largas + salidas largas = 💸. Ingeniería de contexto ahorra.</span></motion.div>
        <h3 style={{ marginTop: 14 }}>🗄️ Elige tu vector DB</h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.keys(DB_INFO).map((d) => (
            <button key={d} className="btn ghost" style={{ borderColor: db === d ? '#7c6cff' : undefined, padding: '8px 12px', fontSize: 13 }} onClick={() => setDb(d)}>{d}</button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 8 }}>📌 <b>{db}:</b> {DB_INFO[db]}</p>
        <h3 style={{ marginTop: 14 }}>✂️ Chunk: {chunk} tokens · 📦 Recuperas top-{k} · 🌡️ Temp: {temp}</h3>
        <label className="muted">Tamaño de chunk</label>
        <input type="range" min={128} max={2048} step={128} value={chunk} onChange={(e) => { setChunk(+e.target.value); playSfx('click'); }} />
        <label className="muted">Chunks recuperados (top-k)</label>
        <input type="range" min={1} max={8} step={1} value={k} onChange={(e) => { setK(+e.target.value); playSfx('click'); }} />
        <label className="muted">Temperatura</label>
        <input type="range" min={0} max={1} step={0.1} value={temp} onChange={(e) => setTemp(+e.target.value)} />
        <motion.div className="feedback good" style={{ marginTop: 10 }} key={`${ctxTokens}-${temp}`} initial={{ scale: 0.98 }} animate={{ scale: 1 }}>
          📦 Contexto RAG: ~{ctxTokens.toLocaleString()} tokens (+${ctxCost.toFixed(4)}) → <b>total ${total.toFixed(4)}</b> por llamada
        </motion.div>
        {warnings.map((w) => (
          <div key={w} className={`feedback ${w.startsWith('✅') ? 'good' : 'bad'}`} style={{ marginTop: 6 }}>{w}</div>
        ))}
      </div>
      <div className="card">
        <h3>❓ Mini-quiz RAG (+12 XP)</h3>
        {QUIZ.map((q) => (
          <div key={q.id} style={{ marginBottom: 12 }}>
            <p><b>{q.q}</b></p>
            {q.opts.map((o, i) => (
              <button key={i} disabled={quizDone} className={`opt ${answers[q.id] === i ? 'selected' : ''} ${quizDone ? (i === q.a ? 'correct' : answers[q.id] === i ? 'wrong' : '') : ''}`} onClick={() => { setAnswers((a) => ({ ...a, [q.id]: i })); playSfx('click'); }}>{o}</button>
            ))}
          </div>
        ))}
        {!quizDone
          ? <button className="btn" onClick={checkQuiz}>Comprobar 🧪</button>
          : <button className="btn ghost" onClick={retryQuiz}>Reintentar 🔁</button>}
        {quizDone && <div className="feedback good">📖 RAG = chunk → embed → vector DB → retrieve → generate con citas. Más barato que fine-tuning y sin reentrenar.</div>}
      </div>
    </div>
  );
}
