import type { ProgressData } from '../store/progress';
import type { GuidedStep, SystemId } from '../core/types';
import { MASTERY_THRESHOLD } from '../quiz/engine';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number; // 0..1
}

export function computeAchievements(d: ProgressData, totalStructures: number, guided: GuidedStep[]): Achievement[] {
  const viewed = Object.keys(d.viewed).length;
  const best = Math.max(0, ...d.attempts.map((a) => a.scorePct));
  const bestPractical = Math.max(0, ...d.attempts.filter((a) => a.practical).map((a) => a.scorePct));
  const days = Object.keys(d.studyByDay).length;
  const guidedDone = guided.filter((g) => d.guidedDone.includes(g.id)).length;
  const mk = (id: string, title: string, description: string, value: number, target: number): Achievement => ({
    id, title, description, unlocked: value >= target, progress: Math.min(1, value / target),
  });
  return [
    mk('primer-paso', 'Primer paso', 'Consulta tu primera estructura.', viewed, 1),
    mk('explorador', 'Explorador', 'Consulta 25 estructuras diferentes.', viewed, 25),
    mk('anatomista', 'Anatomista', 'Consulta todas las estructuras del perro.', viewed, totalStructures),
    mk('primer-quiz', 'A prueba', 'Completa tu primer cuestionario.', d.attempts.length, 1),
    mk('excelencia', 'Excelencia', 'Obtén 90 % o más en un cuestionario.', best, 90),
    mk('perfecto', 'Puntuación perfecta', 'Obtén 100 % en un cuestionario.', best, 100),
    mk('ojo-clinico', 'Ojo clínico', 'Obtén 80 % o más en una evaluación práctica 3D.', bestPractical, 80),
    mk('constancia', 'Constancia', 'Estudia en 5 días diferentes.', days, 5),
    mk('una-hora', 'Una hora de laboratorio', 'Acumula 60 minutos de estudio.', d.studySeconds / 60, 60),
    mk('guiado', 'Ruta completa', 'Completa todos los pasos del estudio guiado.', guidedDone, guided.length || 1),
    mk('coleccionista', 'Coleccionista', 'Guarda 10 estructuras en favoritos.', d.favorites.length, 10),
  ];
}

/** Dominio por sistema a partir de todas las respuestas registradas. */
export function masteryBySystem(d: ProgressData): Partial<Record<SystemId, { correct: number; total: number; pct: number }>> {
  const acc: Partial<Record<SystemId, { correct: number; total: number; pct: number }>> = {};
  for (const a of d.attempts) {
    for (const [sys, t] of Object.entries(a.topics) as [SystemId, { correct: number; total: number }][]) {
      const cur = (acc[sys] ??= { correct: 0, total: 0, pct: 0 });
      cur.correct += t.correct;
      cur.total += t.total;
    }
  }
  for (const v of Object.values(acc)) if (v) v.pct = v.total ? (v.correct / v.total) * 100 : 0;
  return acc;
}

/** Progreso global: cobertura de fichas (40 %), estudio guiado (30 %) y sistemas dominados (30 %). */
export function overallProgress(d: ProgressData, structureIds: string[], guided: GuidedStep[], systemCount: number) {
  const coverage = structureIds.filter((id) => d.viewed[id]).length / Math.max(structureIds.length, 1);
  const guidedPct = guided.filter((g) => d.guidedDone.includes(g.id)).length / Math.max(guided.length, 1);
  const mastery = masteryBySystem(d);
  const mastered = Object.values(mastery).filter((m) => m && m.total >= 3 && m.pct / 100 >= MASTERY_THRESHOLD).length;
  const masteryPct = mastered / Math.max(systemCount, 1);
  return {
    coverage: coverage * 100,
    guided: guidedPct * 100,
    mastery: masteryPct * 100,
    total: (coverage * 0.4 + guidedPct * 0.3 + masteryPct * 0.3) * 100,
  };
}
