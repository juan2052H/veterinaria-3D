import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, MousePointerClick, XCircle } from 'lucide-react';
import { buildQuiz, grade, rngFrom, shuffle, summarize, TYPE_LABEL, type Answer, type QuizConfig } from '../quiz/engine';
import type { MatchQuestion, Question } from '../core/types';
import { useQuestionPool, useStructureMap, useStructures } from '../store/content';
import { useProgress } from '../store/progress';
import { useViewer } from '../viewer/viewerStore';
import { AnatomyViewer } from '../viewer/AnatomyViewer';
import { ViewerToolbar } from '../viewer/ViewerToolbar';
import { Button, Card, EmptyState, ProgressBar, SystemBadge, cx, inputCls } from '../components/ui';

export default function QuizRunnerPage() {
  const config = (useLocation().state as { config?: QuizConfig } | null)?.config;
  if (!config) return <Navigate to="/cuestionarios" replace />;
  return <Runner config={config} />;
}

function Runner({ config }: { config: QuizConfig }) {
  const pool = useQuestionPool();
  const structures = useStructures();
  const byId = useStructureMap();
  const addAttempt = useProgress((s) => s.addAttempt);
  const navigate = useNavigate();
  const questions = useMemo(() => buildQuiz(config, pool, structures), [config, pool, structures]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [revealed, setRevealed] = useState(false);
  const startedAt = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const finished = useRef(false);
  const q = questions[index];
  const answer = answers[index] ?? null;
  const practice = config.mode === 'practica';

  const finish = (finalAnswers: Answer[]) => {
    if (finished.current) return;
    finished.current = true;
    const duration = Math.round((Date.now() - startedAt.current) / 1000);
    const result = summarize(config, questions, finalAnswers, duration, (id) => byId.get(id)?.name ?? id);
    const attempt = addAttempt({ ...result, config });
    navigate(`/resultados/${attempt.id}`, { replace: true });
  };

  // Temporizador
  useEffect(() => {
    if (!config.timeLimitSec) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [config.timeLimitSec]);
  const remaining = config.timeLimitSec ? Math.max(0, config.timeLimitSec - Math.floor((now - startedAt.current) / 1000)) : null;
  useEffect(() => {
    if (remaining === 0) finish(answers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // Preparar el visor para preguntas de identificación 3D
  useEffect(() => {
    if (q?.type === 'identify3d') {
      const st = byId.get(q.structureId);
      if (st) {
        useViewer.getState().enterQuizMode(st.system, st.sex);
        useViewer.getState().camera({ kind: 'view', view: 'iso' });
      }
    }
  }, [q, byId]);
  useEffect(() => () => useViewer.getState().exitQuizMode(), []);

  if (!questions.length) {
    return <div className="p-6"><EmptyState title="No hay preguntas que coincidan con la configuración.">Amplía los sistemas, tipos o nivel seleccionados.</EmptyState></div>;
  }

  const setAnswer = (a: Answer) => {
    if (revealed) return;
    const next = [...answers];
    next[index] = a;
    setAnswers(next);
  };

  const reveal = () => {
    setRevealed(true);
    if (q.type === 'identify3d') {
      const v = useViewer.getState();
      const picked = v.selectedMesh;
      const ok = grade(q, answer).correct;
      v.set({ quiz: { active: true, correctId: q.structureId, wrongMesh: ok ? undefined : picked ?? undefined }, selectedMesh: null });
    }
  };

  const next = () => {
    if (index + 1 >= questions.length) return finish(answers);
    setRevealed(false);
    setIndex(index + 1);
  };

  const result = revealed ? grade(q, answer) : null;
  const hasAnswer = answer !== null && answer !== '' && !(Array.isArray(answer) && answer.some((x) => !x));
  const mm = remaining !== null ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : null;

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink-900 dark:text-white">{config.title}</div>
          <div className="text-xs text-ink-500">Pregunta {index + 1} de {questions.length} · {TYPE_LABEL[q.type]} · {practice ? 'Práctica' : 'Examen'}</div>
        </div>
        {mm && (
          <div className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums', remaining! < 60 ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-ink-100 dark:bg-ink-800')} role="timer" aria-live="off">
            <Clock size={15} /> {mm}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={() => { if (confirm('¿Finalizar la evaluación ahora? Las preguntas sin responder contarán como incorrectas.')) finish(answers); }}>Finalizar</Button>
      </div>
      <ProgressBar value={(index / questions.length) * 100} className="mb-5" />

      <div className={cx('grid flex-1 gap-5', q.type === 'identify3d' && 'lg:grid-cols-[1fr,340px]')}>
        {q.type === 'identify3d' && (
          <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-ink-200 dark:border-ink-800">
            <AnatomyViewer
              className="absolute inset-0"
              showDisclaimer={false}
              onPick={(info) => {
                if (revealed || !info.structureId) return;
                useViewer.getState().select(info.meshName, info.structureId);
                setAnswer(info.structureId);
              }}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3"><ViewerToolbar minimal /></div>
          </div>
        )}

        <Card className="h-fit">
          <div className="mb-3"><SystemBadge id={q.topic} /></div>
          <h2 className="text-lg font-semibold leading-snug text-ink-900 dark:text-white">{q.prompt}</h2>
          <div className="mt-5">
            <QuestionBody q={q} answer={answer} setAnswer={setAnswer} revealed={revealed} />
          </div>

          {result && (
            <div className={cx('mt-5 rounded-lg p-4 text-sm animate-fadein', result.correct ? 'bg-green-50 text-green-900 dark:bg-green-500/10 dark:text-green-200' : 'bg-red-50 text-red-900 dark:bg-red-500/10 dark:text-red-200')} role="status">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                {result.correct ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                {result.correct ? 'Correcto' : result.score > 0 ? `Parcialmente correcto (${Math.round(result.score * 100)} %)` : 'Incorrecto'}
              </div>
              {q.type === 'identify3d' && !result.correct && (
                <p className="mb-1">Seleccionaste: <b>{typeof answer === 'string' ? byId.get(answer)?.name : 'nada'}</b>. La estructura correcta aparece resaltada en verde.</p>
              )}
              <p>{q.explanation}</p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {practice && !revealed ? (
              <>
                <Button variant="ghost" onClick={reveal}>No lo sé</Button>
                <Button onClick={reveal} disabled={!hasAnswer}>Responder</Button>
              </>
            ) : (
              <Button onClick={next}>
                {index + 1 >= questions.length ? 'Ver resultados' : practice ? 'Siguiente' : hasAnswer ? 'Siguiente' : 'Omitir'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function QuestionBody({ q, answer, setAnswer, revealed }: { q: Question; answer: Answer; setAnswer: (a: Answer) => void; revealed: boolean }) {
  switch (q.type) {
    case 'multiple':
      return (
        <div className="space-y-2" role="radiogroup">
          {q.options.map((o, i) => {
            const chosen = answer === i;
            const state = revealed ? (i === q.answer ? 'ok' : chosen ? 'bad' : '') : chosen ? 'sel' : '';
            return (
              <button key={i} role="radio" aria-checked={chosen} onClick={() => setAnswer(i)}
                className={cx('flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition',
                  state === 'ok' && 'border-green-500 bg-green-50 dark:bg-green-500/10',
                  state === 'bad' && 'border-red-500 bg-red-50 dark:bg-red-500/10',
                  state === 'sel' && 'border-brand-500 bg-brand-50 dark:bg-brand-500/10',
                  !state && 'border-ink-200 hover:border-brand-400 dark:border-ink-700')}>
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-[10px] font-semibold">{String.fromCharCode(65 + i)}</span>
                {o}
              </button>
            );
          })}
        </div>
      );
    case 'truefalse':
      return (
        <div className="grid grid-cols-2 gap-3">
          {[true, false].map((v) => {
            const chosen = answer === v;
            const state = revealed ? (v === q.answer ? 'ok' : chosen ? 'bad' : '') : chosen ? 'sel' : '';
            return (
              <button key={String(v)} onClick={() => setAnswer(v)} aria-pressed={chosen}
                className={cx('rounded-lg border p-4 text-sm font-medium transition',
                  state === 'ok' && 'border-green-500 bg-green-50 dark:bg-green-500/10',
                  state === 'bad' && 'border-red-500 bg-red-50 dark:bg-red-500/10',
                  state === 'sel' && 'border-brand-500 bg-brand-50 dark:bg-brand-500/10',
                  !state && 'border-ink-200 hover:border-brand-400 dark:border-ink-700')}>
                {v ? 'Verdadero' : 'Falso'}
              </button>
            );
          })}
        </div>
      );
    case 'fill':
      return (
        <div>
          <input value={typeof answer === 'string' ? answer : ''} onChange={(e) => setAnswer(e.target.value)} disabled={revealed}
            placeholder="Escribe el nombre anatómico…" className={inputCls} aria-label="Respuesta" autoFocus />
          {revealed && <p className="mt-2 text-sm text-ink-500">Respuestas aceptadas: {q.answers.join(' · ')}</p>}
        </div>
      );
    case 'match':
      return <MatchBody q={q} answer={answer} setAnswer={setAnswer} revealed={revealed} />;
    case 'identify3d':
      return (
        <div className="flex items-center gap-2 rounded-lg bg-ink-50 p-3 text-sm text-ink-600 dark:bg-ink-850 dark:text-ink-300">
          <MousePointerClick size={18} className="shrink-0 text-brand-500" />
          {answer ? 'Estructura seleccionada. Puedes cambiarla antes de responder.' : 'Haz clic sobre la estructura en el modelo 3D. Puedes rotar y acercar la vista.'}
        </div>
      );
  }
}

function MatchBody({ q, answer, setAnswer, revealed }: { q: MatchQuestion; answer: Answer; setAnswer: (a: Answer) => void; revealed: boolean }) {
  const options = useMemo(() => shuffle(q.pairs.map((p) => p.right), rngFrom(q.id.length * 7919)), [q]);
  const current = Array.isArray(answer) ? answer : q.pairs.map(() => '');
  return (
    <div className="space-y-2">
      {q.pairs.map((p, i) => {
        const ok = revealed && current[i] === p.right;
        return (
          <div key={p.left} className={cx('grid items-center gap-2 rounded-lg border p-2 sm:grid-cols-2',
            revealed ? (ok ? 'border-green-500' : 'border-red-500') : 'border-ink-200 dark:border-ink-700')}>
            <span className="text-sm font-medium">{p.left}</span>
            <select value={current[i]} disabled={revealed} aria-label={`Función de ${p.left}`}
              onChange={(e) => { const n = [...current]; n[i] = e.target.value; setAnswer(n); }} className={inputCls}>
              <option value="">Seleccione…</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {revealed && !ok && <span className="text-xs text-green-600 sm:col-span-2 dark:text-green-400">Correcto: {p.right}</span>}
          </div>
        );
      })}
    </div>
  );
}
