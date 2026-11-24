import type { QuizAttempt } from '../quiz/engine';
import { topicBreakdown } from '../quiz/engine';
import { SYSTEM_BY_ID } from '../core/systems';

/** Exporta el resultado de una evaluación a PDF (jsPDF se carga bajo demanda). */
export async function exportAttemptPdf(attempt: QuizAttempt, studentName: string, speciesName: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  let y = 18;

  const ensure = (h: number) => {
    if (y + h > 282) {
      doc.addPage();
      y = 18;
    }
  };
  const text = (t: string, size = 10, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [30, 35, 45]) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(t, W - M * 2) as string[];
    ensure(lines.length * size * 0.42 + 1);
    doc.text(lines, M, y);
    y += lines.length * size * 0.42 + 1.5;
  };

  doc.setFillColor(3, 158, 136);
  doc.rect(0, 0, W, 10, 'F');
  text('VetAnatomía 3D — Informe de evaluación', 16, 'bold');
  text(`${attempt.title}  ·  ${speciesName}`, 11, 'normal', [90, 100, 120]);
  y += 2;
  text(`Estudiante: ${studentName}`);
  text(`Fecha: ${new Date(attempt.date).toLocaleString('es-CO')}`);
  text(`Modalidad: ${attempt.practical ? 'Evaluación práctica 3D' : attempt.mode === 'examen' ? 'Examen con tiempo' : 'Práctica'}`);
  y += 2;
  const mins = Math.floor(attempt.durationSec / 60);
  const secs = attempt.durationSec % 60;
  text(`Calificación: ${attempt.grade.toFixed(1)} / 5.0     Porcentaje: ${attempt.scorePct} %`, 13, 'bold', [3, 120, 105]);
  text(`Respuestas correctas: ${attempt.correct}     Incorrectas: ${attempt.total - attempt.correct}     Total: ${attempt.total}     Tiempo: ${mins} min ${secs} s`);
  y += 2;

  const { mastered, reinforce } = topicBreakdown(attempt);
  text('Resultados por sistema', 12, 'bold');
  for (const [sys, t] of Object.entries(attempt.topics)) {
    if (!t) continue;
    text(`•  ${SYSTEM_BY_ID[sys as keyof typeof SYSTEM_BY_ID].name}: ${t.correct}/${t.total} (${Math.round((t.correct / t.total) * 100)} %)`);
  }
  y += 1;
  text(`Temas dominados: ${mastered.map((s) => SYSTEM_BY_ID[s].shortName).join(', ') || 'ninguno todavía'}`);
  text(`Temas que necesitan refuerzo: ${reinforce.map((s) => SYSTEM_BY_ID[s].shortName).join(', ') || 'ninguno'}`);
  y += 3;

  const wrong = attempt.items.filter((i) => !i.correct);
  text(wrong.length ? 'Explicación de las respuestas incorrectas' : 'Todas las respuestas fueron correctas.', 12, 'bold');
  wrong.forEach((it, i) => {
    ensure(24);
    text(`${i + 1}. ${it.prompt}`, 10, 'bold');
    text(`Tu respuesta: ${it.userAnswer}`, 9, 'normal', [185, 28, 28]);
    text(`Respuesta correcta: ${it.correctAnswer}`, 9, 'normal', [21, 128, 61]);
    text(it.explanation, 9, 'normal', [70, 80, 95]);
    y += 1.5;
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140, 150, 165);
    doc.text(`Página ${p} de ${pages}`, W - M, 292, { align: 'right' });
  }
  doc.save(`evaluacion-${new Date(attempt.date).toISOString().slice(0, 10)}.pdf`);
}
