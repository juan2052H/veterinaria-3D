import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Layers, Play, Shuffle, Target, Trash2 } from 'lucide-react';
import { QuizBuilder } from '../quiz/QuizBuilder';
import type { QuizConfig } from '../quiz/engine';
import { TYPE_LABEL } from '../quiz/engine';
import { useProgress } from '../store/progress';
import { useQuestionPool } from '../store/content';
import { SYSTEMS, SYSTEM_BY_ID } from '../core/systems';
import type { SystemId } from '../core/types';
import { Button, Card, PageHeader, inputCls } from '../components/ui';

export function useStartQuiz() {
  const navigate = useNavigate();
  return (config: QuizConfig) => navigate('/evaluacion', { state: { config: { ...config, seed: config.seed ?? Date.now() } } });
}

export default function QuizzesPage() {
  const start = useStartQuiz();
  const pool = useQuestionPool();
  const saved = useProgress((s) => s.data.savedQuizzes);
  const saveQuiz = useProgress((s) => s.saveQuiz);
  const removeSaved = useProgress((s) => s.removeSavedQuiz);
  const [system, setSystem] = useState<SystemId>('oseo');
  const [savedMsg, setSavedMsg] = useState('');

  const presets: { icon: React.ReactNode; title: string; desc: string; config: QuizConfig }[] = [
    { icon: <Shuffle size={18} />, title: 'Evaluación rápida aleatoria', desc: '10 preguntas de todos los tipos y sistemas, con retroalimentación inmediata.',
      config: { title: 'Evaluación rápida', mode: 'practica', topics: [], types: [], count: 10, level: 'todos' } },
    { icon: <Clock size={18} />, title: 'Examen con tiempo limitado', desc: '20 preguntas en 15 minutos. Los resultados se muestran al finalizar.',
      config: { title: 'Examen cronometrado', mode: 'examen', topics: [], types: [], count: 20, level: 'todos', timeLimitSec: 900 } },
    { icon: <Target size={18} />, title: 'Identificación en el modelo 3D', desc: '10 estructuras para señalar directamente sobre el modelo.',
      config: { title: 'Identificación 3D', mode: 'practica', topics: [], types: ['identify3d'], count: 10, level: 'todos' } },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader title="Cuestionarios" subtitle={`Banco de ${pool.length} preguntas: redactadas, generadas a partir de las fichas y creadas por el administrador.`} />

      <div className="grid gap-4 md:grid-cols-3">
        {presets.map((p) => (
          <Card key={p.title} className="flex flex-col">
            <div className="mb-2 flex items-center gap-2 text-brand-600 dark:text-brand-300">{p.icon}<h2 className="font-semibold text-ink-900 dark:text-white">{p.title}</h2></div>
            <p className="flex-1 text-sm text-ink-600 dark:text-ink-400">{p.desc}</p>
            <Button className="mt-4 self-start" onClick={() => start(p.config)}><Play size={15} /> Comenzar</Button>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Cuestionario personalizado" className="lg:col-span-2">
          <QuizBuilder
            defaultTitle="Cuestionario personalizado"
            onStart={start}
            onSave={(c) => { saveQuiz(c); setSavedMsg(`«${c.title}» guardado.`); setTimeout(() => setSavedMsg(''), 2500); }}
          />
          {savedMsg && <p className="mt-3 text-sm text-brand-600 dark:text-brand-300" role="status">{savedMsg}</p>}
        </Card>
        <div className="space-y-6">
          <Card title={<span className="flex items-center gap-2"><Layers size={16} /> Por sistema</span>}>
            <select value={system} onChange={(e) => setSystem(e.target.value as SystemId)} className={inputCls} aria-label="Sistema">
              {SYSTEMS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Button className="mt-3 w-full" variant="secondary"
              onClick={() => start({ title: `Cuestionario: ${SYSTEM_BY_ID[system].shortName}`, mode: 'practica', topics: [system], types: [], count: 10, level: 'todos' })}>
              <Play size={15} /> Comenzar
            </Button>
          </Card>
          <Card title="Mis cuestionarios guardados">
            {saved.length === 0 ? <p className="text-sm text-ink-500">Guarda configuraciones para repetirlas cuando quieras.</p> : (
              <ul className="space-y-2">
                {saved.map((q) => (
                  <li key={q.id} className="rounded-lg border border-ink-200 p-3 text-sm dark:border-ink-800">
                    <div className="font-medium">{q.config.title}</div>
                    <div className="text-xs text-ink-500">
                      {q.config.count} preguntas · {q.config.types.length ? q.config.types.map((t) => TYPE_LABEL[t]).join(', ') : 'todos los tipos'}
                      {q.config.timeLimitSec ? ` · ${q.config.timeLimitSec / 60} min` : ''}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => start({ ...q.config, seed: undefined })}><Play size={13} /> Realizar</Button>
                      <Button size="sm" variant="ghost" onClick={() => removeSaved(q.id)} aria-label={`Eliminar ${q.config.title}`}><Trash2 size={13} /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export function Practice3DPage() {
  const start = useStartQuiz();
  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader
        title="Evaluación práctica 3D"
        subtitle="El sistema muestra el modelo y te pide identificar una estructura. Selecciónala directamente sobre el modelo; recibirás una explicación tras cada respuesta."
      />
      <Card>
        <QuizBuilder fixedTypes={['identify3d']} defaultTitle="Evaluación práctica 3D" onStart={start} />
      </Card>
      <p className="mt-4 text-xs text-ink-500">
        Durante la evaluación se muestra el sistema de la estructura pedida y, como referencia, el esqueleto atenuado. Los nombres no aparecen al pasar el cursor.
      </p>
    </div>
  );
}
