import { useState } from 'react';
import { Play, Save } from 'lucide-react';
import { SYSTEMS } from '../core/systems';
import type { Level, QuestionType, SystemId } from '../core/types';
import { TYPE_LABEL, type QuizConfig } from './engine';
import { Button, Field, cx, inputCls } from '../components/ui';

const ALL_TYPES: QuestionType[] = ['multiple', 'truefalse', 'identify3d', 'match', 'fill'];

/** Formulario para crear cuestionarios personalizados. */
export function QuizBuilder({ fixedTypes, defaultTitle, onStart, onSave }: {
  fixedTypes?: QuestionType[];
  defaultTitle: string;
  onStart: (c: QuizConfig) => void;
  onSave?: (c: QuizConfig) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [topics, setTopics] = useState<SystemId[]>([]);
  const [types, setTypes] = useState<QuestionType[]>(fixedTypes ?? []);
  const [count, setCount] = useState(10);
  const [level, setLevel] = useState<Level | 'todos'>('todos');
  const [mode, setMode] = useState<QuizConfig['mode']>('practica');
  const [minutes, setMinutes] = useState(0);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const config = (): QuizConfig => ({
    title: title.trim() || defaultTitle, topics, types: fixedTypes ?? types, count, level, mode,
    timeLimitSec: minutes > 0 ? minutes * 60 : undefined,
  });

  return (
    <div className="space-y-5">
      <Field label="Nombre del cuestionario"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></Field>
      <div>
        <div className="mb-1.5 text-xs font-medium text-ink-600 dark:text-ink-300">Sistemas (ninguno = todos)</div>
        <div className="flex flex-wrap gap-1.5">
          {SYSTEMS.map((s) => (
            <button key={s.id} type="button" onClick={() => setTopics(toggle(topics, s.id))} aria-pressed={topics.includes(s.id)}
              className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition',
                topics.includes(s.id) ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 hover:border-brand-400 dark:border-ink-700')}>
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.shortName}
            </button>
          ))}
        </div>
      </div>
      {!fixedTypes && (
        <div>
          <div className="mb-1.5 text-xs font-medium text-ink-600 dark:text-ink-300">Tipos de pregunta (ninguno = todos)</div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setTypes(toggle(types, t))} aria-pressed={types.includes(t)}
                className={cx('rounded-full border px-2.5 py-1 text-xs transition', types.includes(t) ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 hover:border-brand-400 dark:border-ink-700')}>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Número de preguntas">
          <input type="number" min={3} max={60} value={count} onChange={(e) => setCount(Math.max(3, Math.min(60, +e.target.value || 3)))} className={inputCls} />
        </Field>
        <Field label="Nivel">
          <select value={level} onChange={(e) => setLevel(e.target.value as Level | 'todos')} className={inputCls}>
            <option value="todos">Todos</option><option value="basico">Básico</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option>
          </select>
        </Field>
        <Field label="Modalidad">
          <select value={mode} onChange={(e) => setMode(e.target.value as QuizConfig['mode'])} className={inputCls}>
            <option value="practica">Práctica (retroalimentación inmediata)</option>
            <option value="examen">Examen (resultados al final)</option>
          </select>
        </Field>
        <Field label="Tiempo límite (min, 0 = sin límite)">
          <input type="number" min={0} max={180} value={minutes} onChange={(e) => setMinutes(Math.max(0, +e.target.value || 0))} className={inputCls} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onStart(config())}><Play size={16} /> Comenzar</Button>
        {onSave && <Button variant="secondary" onClick={() => onSave(config())}><Save size={16} /> Guardar cuestionario</Button>}
      </div>
    </div>
  );
}
