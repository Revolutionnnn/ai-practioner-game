/* Importador del banco externo D1..D5.json al formato del juego.
   Uso:  node scripts/import-d-bank.mjs [--check]
   Lee   ../../bank/D1.json .. ../../bank/D5.json
   Genera src/data/generated/*.ts (sobrescribe, salida versionada en git)
   --check: solo imprime el resumen sin escribir archivos.

   Derivaciones (solo transformaciones mecánicas, sin inventar contenido):
   - single/multiple -> Question (Quiz/Exam/Fails/Arena-ataque)
   - matching         -> MatchCard[] + decoys (MatchGame)
   - ordering         -> OrderPuzzle[] (OrderGame)
   - D4/D5 single+multiple -> Scenario[] (Dilemas/Guardián; el mismo item
     vive también en Quiz: distinto modo, mismo contenido, como en un arcade)
   - RAG-ish D2/D3    -> mini-quiz RAG (RagLab)
   - Prompt/injection: NO se deriva (el banco trae Q&A conceptual sobre el
     tema, no mensajes de usuario clasificables true/false; inventarlos sería
     fabricar contenido). PromptGame y Arena-defensa siguen con su set manual.
*/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', 'bank');
const OUT = resolve(HERE, '..', 'src', 'data', 'generated');

const FILES = ['D1.json', 'D2.json', 'D3.json', 'D4.json', 'D5.json'];
const DOMAIN_N = { D1: 1, D2: 2, D3: 3, D4: 4, D5: 5 };
const LEVEL_N = { basic: 1, intermediate: 2, advanced: 3 };

const short = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');
const titleOf = (prompt) => short(prompt.split(/(?<=[.?!])\s/)[0] || prompt, 90);
const headlineOf = (prompt) => {
  const w = prompt.split(/\s+/).slice(0, 8).join(' ');
  return short(w, 64);
};

const RAG_RE = /rag\b|embed|vector|retrie|recupera|chunk|opensearch|pgvector|neptune|aurora|grounding|cita/i;

function loadBank() {
  const banks = [];
  for (const f of FILES) {
    const raw = JSON.parse(readFileSync(resolve(ROOT, f), 'utf8'));
    banks.push(raw);
  }
  return banks;
}

function optIndex(options, keys) {
  const order = options.map((o) => o.key);
  return keys.map((k) => {
    const i = order.indexOf(k);
    if (i < 0) throw new Error(`correct key ${k} no está en options`);
    return i;
  });
}

function convert(banks) {
  const questions = [];
  const matchCards = [];
  const matchDecoys = new Set();
  const orders = [];
  const dilemmas = [];
  const guardians = [];
  const ragQuiz = [];
  const seenService = new Set();
  const seenUse = new Set();
  let skippedDup = 0;

  for (const bank of banks) {
    const prefix = bank.domain.split('_')[0]; // D1..D5
    const dn = DOMAIN_N[prefix];
    if (!dn) throw new Error(`dominio desconocido: ${bank.domain}`);
    for (const q of bank.questions) {
      const opts = [...q.options].sort((a, b) => a.key.localeCompare(b.key)).map((o) => o.text);
      const task = (q.review_modules && q.review_modules[0]) || prefix;
      const level = LEVEL_N[q.difficulty] ?? 1;

      if (q.type === 'single' || q.type === 'multiple') {        const answer = optIndex(q.options, q.correct);
        questions.push({
          id: `bank-d${dn}-${q.id}`,
          domain: dn,
          task,
          type: answer.length > 1 || q.type === 'multiple' ? 'multi' : 'single',
          q: q.prompt,
          options: opts,
          answer,
          explain: q.explanation,
          level,
        });
        if ((dn === 4 || dn === 5) && answer.length > 0) {
          const sc = {
            id: `bank-sc-d${dn}-${q.id}`,
            title: headlineOf(q.prompt),
            story: q.prompt,
            options: opts,
            answer,
            explain: q.explanation,
            ...(answer.length > 1 ? { multi: true } : {}),
          };
          (dn === 4 ? dilemmas : guardians).push(sc);
        }
        if ((dn === 2 || dn === 3) && RAG_RE.test(`${q.prompt} ${opts.join(' ')}`)) {
          ragQuiz.push({ id: `bank-rag-d${dn}-${q.id}`, q: q.prompt, opts, a: answer[0] });
        }
      } else if (q.type === 'matching') {
        const byKey = Object.fromEntries(q.options.map((o) => [o.key, o.text]));
        q.slots.forEach((slot, i) => {
          const key = q.correct[i];
          if (!key || !byKey[key]) throw new Error(`matching ${q.id}: correct[${i}] sin opción`);
          // El juego usa service/use como identidad: deben ser únicos o la
          // ronda se atasca (dos "RAG" indistinguibles). Se omite el repetido.
          const service = short(byKey[key], 60);
          const use = short(slot.label, 90);
          if (seenService.has(service) || seenUse.has(use)) {
            skippedDup++;
            return;
          }
          seenService.add(service);
          seenUse.add(use);
          matchCards.push({ service, use, hint: short(q.prompt, 90) });
        });
        const used = new Set(q.correct);
        for (const o of q.options) {
          if (!used.has(o.key)) matchDecoys.add(short(o.text, 60));
        }
        // Sin nota `from`: se omitió arriba por unicidad (ver skippedDup).
      } else if (q.type === 'ordering') {        const byKey = Object.fromEntries(q.options.map((o) => [o.key, o.text]));
        const steps = q.correct.map((k) => {
          if (!byKey[k]) throw new Error(`ordering ${q.id}: correct key ${k} sin opción`);
          return byKey[k];
        });
        orders.push({
          id: `bank-order-d${dn}-${q.id}`,
          title: titleOf(q.prompt),
          steps,
          explain: q.explanation,
        });
      } else {
        throw new Error(`tipo desconocido: ${q.type} (id ${q.id})`);
      }
    }
  }
  // Mini-quiz RAG: tope 12 (D3 primero, prompts cortos primero)
  ragQuiz.sort((a, b) => {
    const da = Number(a.id.includes('-d3-'));
    const db = Number(b.id.includes('-d3-'));
    return db - da || a.q.length - b.q.length;
  });
  const ragCapped = ragQuiz.slice(0, 12);
  // Un señuelo idéntico a un `use` real rompería la trampa: se filtra aquí
  // (el juego además filtra contra las cartas elegidas en cada ronda).
  const cardUses = new Set(matchCards.map((c) => c.use));
  const decoys = [...matchDecoys].filter((d) => !cardUses.has(d) && !seenService.has(d));
  console.log(`match duplicados omitidos: ${skippedDup}`);
  return { questions, matchCards, matchDecoys: decoys, orders, dilemmas, guardians, ragQuiz: ragCapped };
}

const J = (v) => JSON.stringify(v);

function tsFile(doc, constName, typeImport, typeName, rows) {
  const body = rows.map((r) => `  ${J(r)},`).join('\n');
  return `${doc}\nimport type { ${typeName} } from '${typeImport}';\n\nexport const ${constName}: ${typeName}[] = [\n${body}\n];\n`;
}

function report(g) {
  const byD = {};
  const byL = { 1: 0, 2: 0, 3: 0 };
  for (const q of g.questions) {
    byD[q.domain] = byD[q.domain] ?? { single: 0, multi: 0 };
    byD[q.domain][q.type === 'multi' ? 'multi' : 'single']++;
    byL[q.level]++;
  }
  console.log('questions:', g.questions.length, JSON.stringify(byD), 'niveles:', JSON.stringify(byL));
  console.log('matchCards:', g.matchCards.length, '| decoys:', g.matchDecoys.length);
  console.log('orderPuzzles:', g.orders.length);
  console.log('dilemmas(D4):', g.dilemmas.length, '| guardians(D5):', g.guardians.length);
  console.log('ragQuiz:', g.ragQuiz.length);
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const banks = loadBank();
  const total = banks.reduce((n, b) => n + b.questions.length, 0);
  console.log(`banco: ${banks.map((b) => `${b.domain}=${b.questions.length}`).join(' ')} (total ${total})`);
  const g = convert(banks);
  report(g);
  if (checkOnly) return;

  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    resolve(OUT, 'questions.ts'),
    tsFile(
      `/* AUTO-GENERADO por scripts/import-d-bank.mjs — no editar a mano.\n   Banco D1-D5 fusionado: single/multiple -> Question. level = mapeo directo\n   basic->1, intermediate->2, advanced->3. */`,
      'GENERATED_QUESTIONS', '../types', 'Question', g.questions,
    ),
  );
  const matchRows = g.matchCards.map(({ from: _from, ...c }) => c);
  writeFileSync(
    resolve(OUT, 'match.ts'),
    `/* AUTO-GENERADO por scripts/import-d-bank.mjs — no editar a mano.\n   matching -> MatchCard (slot↔correct); opciones sobrantes -> decoys. */\nimport type { MatchCard } from '../index';\n\nexport const GENERATED_MATCH_CARDS: MatchCard[] = [\n${matchRows.map((r) => `  ${J(r)},`).join('\n')}\n];\n\nexport const GENERATED_MATCH_DECOYS: string[] = ${J(g.matchDecoys)};\n`,
  );
  writeFileSync(
    resolve(OUT, 'order.ts'),
    tsFile(
      '/* AUTO-GENERADO por scripts/import-d-bank.mjs — no editar a mano.\n   ordering -> OrderPuzzle (steps en el orden de `correct`). */',
      'GENERATED_ORDER_PUZZLES', '../index', 'OrderPuzzle', g.orders,
    ),
  );
  writeFileSync(
    resolve(OUT, 'scenarios.ts'),
    `/* AUTO-GENERADO por scripts/import-d-bank.mjs — no editar a mano.\n   D4/D5 single+multiple -> Scenario (mismo item vive también en Quiz). */\nimport type { Scenario } from '../index';\n\nexport const GENERATED_DILEMMAS: Scenario[] = [\n${g.dilemmas.map((r) => `  ${J(r)},`).join('\n')}\n];\n\nexport const GENERATED_GUARDIANS: Scenario[] = [\n${g.guardians.map((r) => `  ${J(r)},`).join('\n')}\n];\n`,
  );
  writeFileSync(
    resolve(OUT, 'rag.ts'),
    `/* AUTO-GENERADO por scripts/import-d-bank.mjs — no editar a mano.\n   D2/D3 sobre RAG/embeddings/vectorial -> mini-quiz RAG. */\nimport type { RagQuizItem } from '../rag';\n\nexport const GENERATED_RAG_QUIZ: RagQuizItem[] = [\n${g.ragQuiz.map((r) => `  ${J(r)},`).join('\n')}\n];\n`,
  );
  console.log('escrito en', OUT);
}

main();
