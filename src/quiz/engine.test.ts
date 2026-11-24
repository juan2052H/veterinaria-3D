import { describe, expect, it } from 'vitest';
import { buildQuiz, generateQuestions, grade, normalize, summarize, topicBreakdown, type QuizConfig } from './engine';
import { DOG_STRUCTURES } from '../species/dog/structures';
import { DOG_QUESTIONS } from '../species/dog/questions';
import type { Question } from '../core/types';

const pool = [...DOG_QUESTIONS, ...generateQuestions(DOG_STRUCTURES)];
const base: QuizConfig = { title: 't', mode: 'practica', topics: [], types: [], count: 10, level: 'todos', seed: 7 };

describe('generación de preguntas', () => {
  it('genera una pregunta de identificación 3D por estructura', () => {
    const id3d = pool.filter((q) => q.type === 'identify3d');
    expect(id3d.length).toBe(DOG_STRUCTURES.length);
  });
  it('las preguntas de selección múltiple tienen respuesta válida', () => {
    for (const q of pool) {
      if (q.type === 'multiple') {
        expect(q.answer, q.id).toBeGreaterThanOrEqual(0);
        expect(q.answer, q.id).toBeLessThan(q.options.length);
        expect(new Set(q.options).size, q.id).toBe(q.options.length);
      }
    }
  });
  it('los ids son únicos', () => {
    expect(new Set(pool.map((q) => q.id)).size).toBe(pool.length);
  });
  it('las fichas referencian estructuras existentes', () => {
    const ids = new Set(DOG_STRUCTURES.map((s) => s.id));
    for (const s of DOG_STRUCTURES) for (const r of s.relatedIds ?? []) expect(ids.has(r), `${s.id} → ${r}`).toBe(true);
    for (const q of DOG_QUESTIONS) if (q.structureId) expect(ids.has(q.structureId), q.id).toBe(true);
  });
});

describe('armado de cuestionarios', () => {
  it('respeta cantidad, tema y tipo', () => {
    const q = buildQuiz({ ...base, topics: ['oseo'], types: ['identify3d'], count: 8 }, pool, DOG_STRUCTURES);
    expect(q).toHaveLength(8);
    expect(q.every((x) => x.topic === 'oseo' && x.type === 'identify3d')).toBe(true);
  });
  it('es reproducible con la misma semilla y conserva la respuesta al barajar', () => {
    const a = buildQuiz(base, pool, DOG_STRUCTURES);
    const b = buildQuiz(base, pool, DOG_STRUCTURES);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    const original = DOG_QUESTIONS.find((x) => x.id === 'q1')!;
    const shuffled = buildQuiz({ ...base, types: ['multiple'], count: 200 }, pool, DOG_STRUCTURES).find((x) => x.id === 'q1')!;
    if (original.type === 'multiple' && shuffled.type === 'multiple') {
      expect(shuffled.options[shuffled.answer]).toBe(original.options[original.answer]);
    }
  });
  it('excluye estructuras del otro sexo en identificación 3D', () => {
    const q = buildQuiz({ ...base, types: ['identify3d'], topics: ['reproductor'], count: 20 }, pool, DOG_STRUCTURES, 'male');
    expect(q.map((x) => x.structureId)).not.toContain('uterus');
  });
});

describe('calificación', () => {
  it('califica completar sin tildes ni mayúsculas', () => {
    const q: Question = { id: 'x', type: 'fill', prompt: '', explanation: '', topic: 'oseo', level: 'basico', answers: ['Fémur'] };
    expect(grade(q, 'femur').correct).toBe(true);
    expect(grade(q, '  FÉMUR ').correct).toBe(true);
    expect(grade(q, 'tibia').correct).toBe(false);
    expect(normalize('El Fémur')).toBe('femur');
  });
  it('da crédito parcial en relacionar', () => {
    const q: Question = { id: 'm', type: 'match', prompt: '', explanation: '', topic: 'oseo', level: 'basico',
      pairs: [{ left: 'a', right: '1' }, { left: 'b', right: '2' }] };
    expect(grade(q, ['1', '2'])).toEqual({ correct: true, score: 1 });
    expect(grade(q, ['1', '1'])).toEqual({ correct: false, score: 0.5 });
  });
  it('resume resultados y temas', () => {
    const qs = DOG_QUESTIONS.slice(0, 4);
    const answers = qs.map((q) => (q.type === 'multiple' ? q.answer : q.type === 'truefalse' ? q.answer : null));
    answers[3] = null;
    const r = summarize(base, qs, answers, 30, (id) => id);
    expect(r.correct).toBe(3);
    expect(r.scorePct).toBe(75);
    expect(r.grade).toBe(3.8);
    expect(topicBreakdown(r).mastered).toContain('oseo');
  });
});
