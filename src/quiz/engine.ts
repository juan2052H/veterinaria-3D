/**
 * Motor de cuestionarios: genera preguntas automáticas a partir de las fichas,
 * arma cuestionarios aleatorios según la configuración y califica las respuestas.
 * Es lógica pura (sin React) para poder probarla con Vitest.
 */
import { SYSTEMS, SYSTEM_BY_ID } from '../core/systems';
import type { AnatomicalStructure, Level, Question, QuestionType, SystemId } from '../core/types';

export interface QuizConfig {
  title: string;
  mode: 'practica' | 'examen';
  topics: SystemId[]; // vacío = todos
  types: QuestionType[]; // vacío = todos
  count: number;
  level: Level | 'todos';
  timeLimitSec?: number;
  seed?: number;
}

export type Answer = number | boolean | string | string[] | null;

export interface GradedItem {
  questionId: string;
  type: QuestionType;
  prompt: string;
  topic: SystemId;
  structureId?: string;
  correct: boolean;
  score: number;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
}

export interface QuizAttempt {
  id: string;
  title: string;
  mode: QuizConfig['mode'];
  practical: boolean;
  date: number;
  durationSec: number;
  total: number;
  correct: number;
  scorePct: number;
  /** Calificación en escala 0,0 – 5,0 (escala usual en Colombia). */
  grade: number;
  topics: Partial<Record<SystemId, { correct: number; total: number }>>;
  items: GradedItem[];
  /** Configuración usada, para poder repetir el cuestionario. */
  config?: QuizConfig;
}

/* ------------------------------ Utilidades ------------------------------ */

export function rngFrom(seed = Date.now()) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^(el|la|los|las)\s+/, '')
    .replace(/[.\s]+/g, ' ')
    .trim();

/* -------------------------- Generación automática -------------------------- */

function stripPrefix(name: string) {
  return name.replace(/^(músculos?|vena|arteria|nervio|linfonodos?|articulación( de la| del)?|ligamento)\s+/i, '');
}

export function generateQuestions(structures: AnatomicalStructure[]): Question[] {
  const out: Question[] = [];
  const rnd = rngFrom(42);
  for (const s of structures) {
    out.push({
      id: `auto-3d-${s.id}`, type: 'identify3d', generated: true, topic: s.system, level: s.level, structureId: s.id,
      prompt: `Seleccione en el modelo 3D: ${s.name}${s.commonName ? ` (${s.commonName})` : ''}`,
      explanation: `${s.name}: ${s.location}`,
    });

    const otherSystems = shuffle(SYSTEMS.filter((x) => x.id !== s.system), rnd).slice(0, 3).map((x) => x.name);
    const sysOptions = shuffle([SYSTEM_BY_ID[s.system].name, ...otherSystems], rnd);
    out.push({
      id: `auto-sys-${s.id}`, type: 'multiple', generated: true, topic: s.system, level: 'basico', structureId: s.id,
      prompt: `¿A qué sistema pertenece la estructura «${s.name}»?`,
      options: sysOptions, answer: sysOptions.indexOf(SYSTEM_BY_ID[s.system].name),
      explanation: `${s.name} pertenece al ${SYSTEM_BY_ID[s.system].name.toLowerCase()}.`,
    });

    const answers = [s.name, s.latinName, stripPrefix(s.name), ...(s.commonName ? [s.commonName] : [])];
    out.push({
      id: `auto-fill-${s.id}`, type: 'fill', generated: true, topic: s.system, level: s.level === 'basico' ? 'intermedio' : s.level, structureId: s.id,
      prompt: `Escriba el nombre anatómico de la estructura: «${s.definition}»`,
      answers, explanation: `Respuesta: ${s.name} (${s.latinName}).`,
    });

    const distractors = shuffle(structures.filter((x) => x.id !== s.id && x.region !== s.region), rnd).slice(0, 3);
    if (distractors.length === 3) {
      const opts = shuffle([s.location, ...distractors.map((d) => d.location)], rnd);
      out.push({
        id: `auto-loc-${s.id}`, type: 'multiple', generated: true, topic: s.system, level: 'intermedio', structureId: s.id,
        prompt: `¿Cuál es la ubicación de «${s.name}»?`,
        options: opts, answer: opts.indexOf(s.location),
        explanation: `${s.name}: ${s.location}`,
      });
    }
  }
  // Relacionar estructura ↔ función, en grupos de 4 del mismo sistema
  const bySystem = new Map<SystemId, AnatomicalStructure[]>();
  structures.forEach((s) => bySystem.set(s.system, [...(bySystem.get(s.system) ?? []), s]));
  for (const [system, list] of bySystem) {
    const unique = list.filter((s, i) => list.findIndex((x) => x.shortFunction === s.shortFunction) === i);
    for (let i = 0; i + 4 <= unique.length; i += 4) {
      const group = unique.slice(i, i + 4);
      out.push({
        id: `auto-match-${system}-${i}`, type: 'match', generated: true, topic: system, level: 'intermedio',
        prompt: 'Relacione cada estructura con su función principal.',
        pairs: group.map((s) => ({ left: s.name, right: s.shortFunction })),
        explanation: group.map((s) => `${s.name}: ${s.shortFunction.toLowerCase()}`).join('. ') + '.',
      });
    }
  }
  return out;
}

/* ------------------------------ Armado ------------------------------ */

export function buildQuiz(config: QuizConfig, pool: Question[], structures: AnatomicalStructure[], sex?: 'male' | 'female'): Question[] {
  const rnd = rngFrom(config.seed ?? Date.now());
  const byId = new Map(structures.map((s) => [s.id, s]));
  const matches = (q: Question, strictLevel: boolean) => {
    if (config.topics.length && !config.topics.includes(q.topic)) return false;
    if (config.types.length && !config.types.includes(q.type)) return false;
    if (q.type === 'identify3d') {
      const st = byId.get(q.structureId);
      if (!st) return false;
      if (sex && st.sex && st.sex !== sex) return false;
    }
    if (strictLevel && config.level !== 'todos' && q.level !== config.level) return false;
    return true;
  };
  let selected = shuffle(pool.filter((q) => matches(q, true)), rnd);
  if (selected.length < config.count) {
    // Completar con otros niveles si no hay suficientes preguntas del nivel pedido.
    const extra = shuffle(pool.filter((q) => matches(q, false) && !selected.includes(q)), rnd);
    selected = [...selected, ...extra];
  }
  // Evitar preguntas repetidas sobre la misma estructura cuando sea posible
  const seen = new Set<string>();
  const primary: Question[] = [];
  const rest: Question[] = [];
  for (const q of selected) {
    if (q.structureId && seen.has(q.structureId)) rest.push(q);
    else {
      primary.push(q);
      if (q.structureId) seen.add(q.structureId);
    }
  }
  return [...primary, ...rest].slice(0, config.count).map((q) => prepare(q, rnd));
}

/** Baraja las opciones de las preguntas de selección múltiple conservando la respuesta. */
function prepare(q: Question, rnd: () => number): Question {
  if (q.type !== 'multiple') return q;
  const order = shuffle(q.options.map((_, i) => i), rnd);
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
}

/* ------------------------------ Calificación ------------------------------ */

export function grade(q: Question, answer: Answer): { correct: boolean; score: number } {
  switch (q.type) {
    case 'multiple':
      return bool(answer === q.answer);
    case 'truefalse':
      return bool(answer === q.answer);
    case 'identify3d':
      return bool(answer === q.structureId);
    case 'fill': {
      if (typeof answer !== 'string' || !answer.trim()) return bool(false);
      const a = normalize(answer);
      return bool(q.answers.some((x) => normalize(x) === a));
    }
    case 'match': {
      if (!Array.isArray(answer)) return bool(false);
      const ok = q.pairs.filter((p, i) => answer[i] === p.right).length;
      return { correct: ok === q.pairs.length, score: ok / q.pairs.length };
    }
  }
}

const bool = (c: boolean) => ({ correct: c, score: c ? 1 : 0 });

export function describeAnswer(q: Question, answer: Answer, nameOf: (id: string) => string): { user: string; correct: string } {
  const none = 'Sin responder';
  switch (q.type) {
    case 'multiple':
      return { user: typeof answer === 'number' ? q.options[answer] : none, correct: q.options[q.answer] };
    case 'truefalse':
      return { user: typeof answer === 'boolean' ? (answer ? 'Verdadero' : 'Falso') : none, correct: q.answer ? 'Verdadero' : 'Falso' };
    case 'identify3d':
      return { user: typeof answer === 'string' ? nameOf(answer) : none, correct: nameOf(q.structureId) };
    case 'fill':
      return { user: typeof answer === 'string' && answer ? answer : none, correct: q.answers[0] };
    case 'match':
      return {
        user: Array.isArray(answer) ? q.pairs.map((p, i) => `${p.left} → ${answer[i] || '—'}`).join('; ') : none,
        correct: q.pairs.map((p) => `${p.left} → ${p.right}`).join('; '),
      };
  }
}

export function summarize(
  config: QuizConfig,
  questions: Question[],
  answers: Answer[],
  durationSec: number,
  nameOf: (id: string) => string,
): Omit<QuizAttempt, 'id'> {
  const items: GradedItem[] = questions.map((q, i) => {
    const g = grade(q, answers[i] ?? null);
    const d = describeAnswer(q, answers[i] ?? null, nameOf);
    return {
      questionId: q.id, type: q.type, prompt: q.prompt, topic: q.topic, structureId: q.structureId,
      correct: g.correct, score: g.score, userAnswer: d.user, correctAnswer: d.correct, explanation: q.explanation,
    };
  });
  const total = items.length;
  const points = items.reduce((a, it) => a + it.score, 0);
  const correct = items.filter((it) => it.correct).length;
  const scorePct = total ? Math.round((points / total) * 1000) / 10 : 0;
  const topics: QuizAttempt['topics'] = {};
  for (const it of items) {
    const t = (topics[it.topic] ??= { correct: 0, total: 0 });
    t.total += 1;
    if (it.correct) t.correct += 1;
  }
  return {
    title: config.title,
    mode: config.mode,
    practical: config.types.length === 1 && config.types[0] === 'identify3d',
    date: Date.now(),
    durationSec,
    total,
    correct,
    scorePct,
    grade: Math.round((points / Math.max(total, 1)) * 50) / 10,
    topics,
    items,
  };
}

export const MASTERY_THRESHOLD = 0.7;

export function topicBreakdown(attempt: Pick<QuizAttempt, 'topics'>) {
  const mastered: SystemId[] = [];
  const reinforce: SystemId[] = [];
  for (const [id, t] of Object.entries(attempt.topics) as [SystemId, { correct: number; total: number }][]) {
    (t.correct / t.total >= MASTERY_THRESHOLD ? mastered : reinforce).push(id);
  }
  return { mastered, reinforce };
}

export const TYPE_LABEL: Record<QuestionType, string> = {
  multiple: 'Selección múltiple',
  truefalse: 'Verdadero o falso',
  identify3d: 'Identificación en 3D',
  match: 'Relacionar',
  fill: 'Completar nombre',
};
