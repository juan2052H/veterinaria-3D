import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, CheckCircle2, Download, RotateCcw, Shuffle, XCircle } from 'lucide-react';
import { useProgress } from '../store/progress';
import { useAuth } from '../store/auth';
import { useSpecies, useStructureMap } from '../store/content';
import { SYSTEMS, SYSTEM_BY_ID } from '../core/systems';
import { topicBreakdown, type QuizAttempt } from '../quiz/engine';
import { computeAchievements, masteryBySystem, overallProgress } from '../lib/achievements';
import { exportAttemptPdf } from '../services/pdf';
import { useStartQuiz } from './QuizzesPage';
import { Button, Card, EmptyState, PageHeader, ProgressBar, Stat, Tabs, cx, formatDuration } from '../components/ui';

export function ResultsPage() {
  const data = useProgress((s) => s.data);
  const species = useSpecies();
  const byId = useStructureMap();
  const [tab, setTab] = useState<'stats' | 'history' | 'achievements' | 'learning'>('stats');
  const prog = overallProgress(data, species.structures.map((s) => s.id), species.guidedPath, SYSTEMS.length);
  const mastery = masteryBySystem(data);
  const achievements = computeAchievements(data, species.structures.length, species.guidedPath);
  const avg = data.attempts.length ? data.attempts.reduce((a, x) => a + x.grade, 0) / data.attempts.length : 0;
  const recentViewed = Object.entries(data.viewed).sort((a, b) => b[1].last - a[1].last).slice(0, 30);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader title="Resultados y estadísticas" subtitle="Identifica tus fortalezas y los temas que necesitan refuerzo." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Progreso general" value={`${Math.round(prog.total)} %`} hint={`Fichas ${Math.round(prog.coverage)} % · Guiado ${Math.round(prog.guided)} % · Dominio ${Math.round(prog.mastery)} %`} />
        <Stat label="Calificación promedio" value={data.attempts.length ? `${avg.toFixed(1)} / 5.0` : '—'} hint={`${data.attempts.length} evaluaciones`} />
        <Stat label="Tiempo de estudio" value={formatDuration(data.studySeconds)} hint={`${Object.keys(data.studyByDay).length} días activos`} />
        <Stat label="Sistemas estudiados" value={`${SYSTEMS.filter((s) => species.structures.some((x) => x.system === s.id && data.viewed[x.id])).length} / ${SYSTEMS.length}`} hint={`${Object.keys(data.viewed).length} estructuras consultadas`} />
      </div>
      <div className="mb-5">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'stats', label: 'Estadísticas' }, { id: 'history', label: 'Historial de evaluaciones' }, { id: 'achievements', label: 'Logros' }, { id: 'learning', label: 'Historial de aprendizaje' }]} />
      </div>

      {tab === 'stats' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Calificación por evaluación (escala 0–5)">
            {data.attempts.length ? <ScoreBars attempts={[...data.attempts].reverse().slice(-20)} /> : <p className="text-sm text-ink-500">Sin evaluaciones todavía.</p>}
          </Card>
          <Card title="Dominio por sistema (respuestas correctas)">
            <ul className="space-y-2.5">
              {SYSTEMS.map((s) => {
                const m = mastery[s.id];
                return (
                  <li key={s.id} className="grid grid-cols-[130px,1fr,64px] items-center gap-3 text-xs" title={m ? `${m.correct} de ${m.total} correctas` : 'Sin preguntas respondidas'}>
                    <span className="flex items-center gap-1.5 truncate text-ink-700 dark:text-ink-300"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />{s.shortName}</span>
                    <ProgressBar value={m?.pct ?? 0} color="#08c4a6" />
                    <span className="text-right tabular-nums text-ink-500">{m ? `${Math.round(m.pct)} %` : '—'}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-ink-500">Se considera dominado un sistema con al menos 70 % de aciertos.</p>
          </Card>
        </div>
      )}

      {tab === 'history' && (
        data.attempts.length === 0 ? <EmptyState title="Aún no has realizado evaluaciones." /> : (
          <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-200 text-left text-xs text-ink-500 dark:border-ink-800">
                <tr><th className="p-3">Evaluación</th><th className="p-3">Fecha</th><th className="p-3">Correctas</th><th className="p-3">%</th><th className="p-3">Nota</th><th className="p-3">Tiempo</th><th className="p-3" /></tr>
              </thead>
              <tbody>
                {data.attempts.map((a) => (
                  <tr key={a.id} className="border-b border-ink-100 last:border-0 dark:border-ink-800">
                    <td className="p-3 font-medium">{a.title}</td>
                    <td className="p-3 text-ink-500">{new Date(a.date).toLocaleString('es-CO')}</td>
                    <td className="p-3 tabular-nums">{a.correct}/{a.total}</td>
                    <td className="p-3 tabular-nums">{a.scorePct}</td>
                    <td className={cx('p-3 font-semibold tabular-nums', a.grade >= 3 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>{a.grade.toFixed(1)}</td>
                    <td className="p-3 text-ink-500">{formatDuration(a.durationSec)}</td>
                    <td className="p-3"><Link to={`/resultados/${a.id}`} className="text-brand-600 hover:underline dark:text-brand-300">Detalle</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'achievements' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((a) => (
            <div key={a.id} className={cx('rounded-xl border p-4', a.unlocked ? 'border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/5' : 'border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900')}>
              <div className="flex items-center gap-2">
                <Award size={20} className={a.unlocked ? 'text-amber-500' : 'text-ink-300'} />
                <span className="font-semibold">{a.title}</span>
                {a.unlocked && <span className="ml-auto text-[10px] font-medium uppercase text-amber-600 dark:text-amber-400">Desbloqueado</span>}
              </div>
              <p className="mt-1 text-xs text-ink-500">{a.description}</p>
              {!a.unlocked && <ProgressBar value={a.progress * 100} color="#f59e0b" className="mt-3" />}
            </div>
          ))}
        </div>
      )}

      {tab === 'learning' && (
        recentViewed.length === 0 ? <EmptyState title="Aún no has consultado estructuras." /> : (
          <Card title="Estructuras consultadas recientemente">
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {recentViewed.map(([id, v]) => byId.get(id) && (
                <li key={id} className="flex items-center justify-between py-2 text-sm">
                  <Link to={`/fichas/${id}`} className="font-medium hover:underline">{byId.get(id)!.name}</Link>
                  <span className="text-xs text-ink-500">{SYSTEM_BY_ID[byId.get(id)!.system].shortName} · {v.count} consulta{v.count > 1 ? 's' : ''} · {new Date(v.last).toLocaleDateString('es-CO')}</span>
                </li>
              ))}
            </ul>
          </Card>
        )
      )}
    </div>
  );
}

/** Barras de calificación por intento (serie única), con tooltip al pasar el cursor. */
function ScoreBars({ attempts }: { attempts: QuizAttempt[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 160;
  return (
    <div className="relative">
      <div className="flex h-[180px] items-end gap-1 border-b border-ink-200 pb-px dark:border-ink-700" role="img" aria-label="Calificaciones de las últimas evaluaciones">
        {[1, 2, 3, 4].map((g) => (
          <div key={g} className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-ink-100 dark:border-ink-800" style={{ bottom: 20 + (g / 5) * H }}>
            <span className="absolute -top-2 left-0 bg-white pr-1 text-[10px] text-ink-400 dark:bg-ink-900">{g}</span>
          </div>
        ))}
        {attempts.map((a, i) => (
          <div key={a.id} className="relative flex h-full flex-1 items-end justify-center pl-4" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className={cx('w-full max-w-[28px] rounded-t transition', hover === i ? 'bg-brand-400' : 'bg-brand-600')} style={{ height: Math.max(2, (a.grade / 5) * H) }} />
          </div>
        ))}
      </div>
      {hover !== null && (
        <div className="pointer-events-none absolute -top-2 right-0 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-ink-700 dark:bg-ink-850">
          <div className="font-medium text-ink-900 dark:text-white">{attempts[hover].title}</div>
          <div className="text-ink-500">{new Date(attempts[hover].date).toLocaleDateString('es-CO')} · Nota {attempts[hover].grade.toFixed(1)} · {attempts[hover].scorePct} %</div>
        </div>
      )}
    </div>
  );
}

export function AttemptDetailPage() {
  const { id } = useParams();
  const attempt = useProgress((s) => s.data.attempts.find((a) => a.id === id));
  const user = useAuth((s) => s.user);
  const species = useSpecies();
  const start = useStartQuiz();
  const navigate = useNavigate();
  if (!attempt) return <div className="p-6"><EmptyState title="Evaluación no encontrada" /></div>;
  const { mastered, reinforce } = topicBreakdown(attempt);
  const wrong = attempt.items.filter((i) => !i.correct);
  const passed = attempt.grade >= 3;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <button onClick={() => navigate('/resultados')} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800 dark:hover:text-ink-200"><ArrowLeft size={15} /> Resultados</button>
      <PageHeader
        title={attempt.title}
        subtitle={`${new Date(attempt.date).toLocaleString('es-CO')} · ${attempt.practical ? 'Evaluación práctica 3D' : attempt.mode === 'examen' ? 'Examen' : 'Práctica'}`}
        actions={
          <>
            {attempt.config && <Button variant="secondary" onClick={() => start(attempt.config!)}><RotateCcw size={16} /> Repetir</Button>}
            {attempt.config && <Button variant="secondary" onClick={() => start({ ...attempt.config!, seed: undefined })}><Shuffle size={16} /> Nueva aleatoria</Button>}
            <Button onClick={() => exportAttemptPdf(attempt, user?.name ?? 'Estudiante', species.name)}><Download size={16} /> Exportar PDF</Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className={cx('rounded-xl p-4 text-white lg:col-span-1', passed ? 'bg-gradient-to-br from-brand-500 to-brand-700' : 'bg-gradient-to-br from-red-500 to-red-700')}>
          <div className="text-xs opacity-80">Calificación</div>
          <div className="text-3xl font-semibold">{attempt.grade.toFixed(1)}</div>
          <div className="text-xs opacity-80">de 5.0 · {passed ? 'Aprobado' : 'No aprobado'}</div>
        </div>
        <Stat label="Conocimiento demostrado" value={`${attempt.scorePct} %`} />
        <Stat label="Correctas" value={<span className="text-green-600 dark:text-green-400">{attempt.correct}</span>} />
        <Stat label="Incorrectas" value={<span className="text-red-600 dark:text-red-400">{attempt.total - attempt.correct}</span>} />
        <Stat label="Tiempo empleado" value={formatDuration(attempt.durationSec)} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card title="Temas dominados">
          {mastered.length ? <ul className="space-y-1 text-sm">{mastered.map((s) => <li key={s} className="flex items-center gap-2"><CheckCircle2 size={15} className="text-green-500" />{SYSTEM_BY_ID[s].name} <span className="text-ink-500">({attempt.topics[s]!.correct}/{attempt.topics[s]!.total})</span></li>)}</ul> : <p className="text-sm text-ink-500">Ningún tema alcanzó el 70 % en esta evaluación.</p>}
        </Card>
        <Card title="Temas que necesitan refuerzo">
          {reinforce.length ? (
            <ul className="space-y-1 text-sm">
              {reinforce.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <XCircle size={15} className="text-red-500" />{SYSTEM_BY_ID[s].name} <span className="text-ink-500">({attempt.topics[s]!.correct}/{attempt.topics[s]!.total})</span>
                  <Link to={`/explorador?systems=${s}${s !== 'oseo' ? ',oseo' : ''}`} className="ml-auto text-xs text-brand-600 hover:underline dark:text-brand-300">Estudiar</Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-500">¡Ninguno! Dominaste todos los temas evaluados.</p>}
        </Card>
      </div>

      <Card title={`Explicación de las respuestas incorrectas (${wrong.length})`} className="mt-6">
        {wrong.length === 0 ? <p className="text-sm text-ink-500">Todas las respuestas fueron correctas.</p> : (
          <ol className="space-y-4">
            {wrong.map((it, i) => (
              <li key={it.questionId + i} className="rounded-lg border border-ink-200 p-4 text-sm dark:border-ink-800">
                <div className="font-medium text-ink-900 dark:text-white">{i + 1}. {it.prompt}</div>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <div><span className="text-xs text-ink-500">Tu respuesta: </span><span className="text-red-600 dark:text-red-400">{it.userAnswer}</span></div>
                  <div><span className="text-xs text-ink-500">Correcta: </span><span className="text-green-600 dark:text-green-400">{it.correctAnswer}</span></div>
                </div>
                <p className="mt-2 text-ink-600 dark:text-ink-300">{it.explanation}</p>
                {it.structureId && <Link to={`/fichas/${it.structureId}`} className="mt-2 inline-block text-xs text-brand-600 hover:underline dark:text-brand-300">Revisar ficha</Link>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
