import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Check, ChevronLeft, ChevronRight, RotateCw, Shuffle } from 'lucide-react';
import { SYSTEMS, SYSTEM_BY_ID } from '../core/systems';
import type { Level, SystemId } from '../core/types';
import { useSpecies, useStructureMap, useStructures } from '../store/content';
import { useProgress } from '../store/progress';
import { useStudyTimer } from '../lib/useStudyTimer';
import { normalize, rngFrom, shuffle } from '../quiz/engine';
import { masteryBySystem } from '../lib/achievements';
import { Button, Card, EmptyState, LevelBadge, PageHeader, ProgressBar, SystemBadge, Tabs, cx, inputCls } from '../components/ui';

type Tab = 'guiado' | 'tarjetas' | 'glosario' | 'repaso';

export default function LearnPage() {
  useStudyTimer();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'guiado';
  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader title="Módulo de aprendizaje" subtitle="Estudia de forma progresiva antes de evaluarte." />
      <div className="mb-6">
        <Tabs<Tab>
          value={tab}
          onChange={(t) => setParams({ tab: t })}
          tabs={[{ id: 'guiado', label: 'Estudio guiado' }, { id: 'tarjetas', label: 'Fichas de estudio' }, { id: 'glosario', label: 'Glosario' }, { id: 'repaso', label: 'Material de repaso' }]}
        />
      </div>
      {tab === 'guiado' && <Guided initial={params.get('paso')} />}
      {tab === 'tarjetas' && <Flashcards />}
      {tab === 'glosario' && <Glossary initial={params.get('q') ?? ''} />}
      {tab === 'repaso' && <Review />}
    </div>
  );
}

function Guided({ initial }: { initial: string | null }) {
  const species = useSpecies();
  const byId = useStructureMap();
  const { guidedDone, viewed } = useProgress((s) => s.data);
  const toggle = useProgress((s) => s.toggleGuided);
  const [open, setOpen] = useState<string>(initial ?? species.guidedPath.find((g) => !guidedDone.includes(g.id))?.id ?? species.guidedPath[0]?.id);
  const navigate = useNavigate();
  const pct = (guidedDone.length / Math.max(species.guidedPath.length, 1)) * 100;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px,1fr]">
      <Card>
        <div className="mb-3 text-xs text-ink-500">{guidedDone.length} de {species.guidedPath.length} completados</div>
        <ProgressBar value={pct} className="mb-4" />
        <ol className="space-y-1">
          {species.guidedPath.map((g) => (
            <li key={g.id}>
              <button onClick={() => setOpen(g.id)}
                className={cx('flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm', open === g.id ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200' : 'hover:bg-ink-50 dark:hover:bg-ink-850')}>
                <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px]', guidedDone.includes(g.id) ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-300 dark:border-ink-600')}>
                  {guidedDone.includes(g.id) && <Check size={12} />}
                </span>
                {g.title}
              </button>
            </li>
          ))}
        </ol>
      </Card>
      {species.guidedPath.filter((g) => g.id === open).map((g) => {
        const seen = g.structureIds.filter((id) => viewed[id]).length;
        return (
          <Card key={g.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink-900 dark:text-white">{g.title}</h2>
                <div className="mt-1 flex flex-wrap gap-1.5"><LevelBadge level={g.level} />{g.systems.map((s) => <SystemBadge key={s} id={s} />)}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => navigate(`/explorador?systems=${g.systems.join(',')}`)}><Box size={16} /> Estudiar en 3D</Button>
                <Button variant={guidedDone.includes(g.id) ? 'secondary' : 'primary'} onClick={() => toggle(g.id)}>
                  <Check size={16} /> {guidedDone.includes(g.id) ? 'Completado' : 'Marcar como completado'}
                </Button>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-700 dark:text-ink-300">{g.intro}</p>
            <div className="mt-5 text-xs font-medium uppercase tracking-wide text-ink-500">Estructuras del paso ({seen}/{g.structureIds.length} consultadas)</div>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {g.structureIds.map((id) => {
                const s = byId.get(id);
                if (!s) return null;
                return (
                  <li key={id} className="rounded-lg border border-ink-200 p-3 dark:border-ink-800">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/fichas/${id}`} className="font-medium hover:text-brand-600 hover:underline dark:hover:text-brand-300">{s.name}</Link>
                      {viewed[id] && <Check size={14} className="text-brand-500" />}
                    </div>
                    <p className="mt-1 text-xs text-ink-500">{s.definition}</p>
                    <Link to={`/explorador?s=${id}`} className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-300"><Box size={12} /> Ubicar en el modelo</Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function Flashcards() {
  const structures = useStructures();
  const markViewed = useProgress((s) => s.markViewed);
  const [system, setSystem] = useState<SystemId | ''>('');
  const [level, setLevel] = useState<Level | ''>('');
  const [seed, setSeed] = useState(1);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Record<string, boolean>>({});

  const deck = useMemo(() => {
    const filtered = structures.filter((s) => (!system || s.system === system) && (!level || s.level === level));
    return seed === 1 ? filtered : shuffle(filtered, rngFrom(seed));
  }, [structures, system, level, seed]);
  const card = deck[Math.min(i, deck.length - 1)];
  const go = (d: number) => { setFlipped(false); setI((x) => (x + d + deck.length) % deck.length); };
  const knownCount = deck.filter((s) => known[s.id]).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr,1fr,auto]">
        <select value={system} onChange={(e) => { setSystem(e.target.value as SystemId | ''); setI(0); }} className={inputCls} aria-label="Sistema">
          <option value="">Todos los sistemas</option>
          {SYSTEMS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={level} onChange={(e) => { setLevel(e.target.value as Level | ''); setI(0); }} className={inputCls} aria-label="Nivel">
          <option value="">Todos los niveles</option><option value="basico">Básico</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option>
        </select>
        <Button variant="secondary" onClick={() => { setSeed(Date.now()); setI(0); setFlipped(false); }}><Shuffle size={16} /> Barajar</Button>
      </div>
      {!card ? (
        <EmptyState title="No hay fichas para este filtro." />
      ) : (
        <>
          <div className="mb-2 flex justify-between text-xs text-ink-500"><span>Tarjeta {i + 1} de {deck.length}</span><span>Dominadas: {knownCount}</span></div>
          <button
            onClick={() => { setFlipped((f) => !f); if (!flipped) markViewed(card.id); }}
            className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-2xl border border-ink-200 bg-white p-8 text-center shadow-sm transition hover:shadow-md dark:border-ink-800 dark:bg-ink-900"
            aria-label="Voltear tarjeta"
          >
            {!flipped ? (
              <>
                <SystemBadge id={card.system} />
                <div className="mt-4 text-3xl font-semibold text-ink-900 dark:text-white">{card.name}</div>
                <div className="mt-1 italic text-ink-500">{card.latinName}</div>
                <div className="mt-6 flex items-center gap-1 text-xs text-ink-400"><RotateCw size={12} /> Toca para ver la respuesta</div>
              </>
            ) : (
              <div className="space-y-3 text-left text-sm animate-fadein">
                <p><span className="font-semibold">Definición: </span>{card.definition}</p>
                <p><span className="font-semibold">Localización: </span>{card.location}</p>
                <p><span className="font-semibold">Función: </span>{card.function}</p>
                <p className="text-ink-500"><span className="font-semibold">Clínica: </span>{card.clinical}</p>
              </div>
            )}
          </button>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => go(-1)}><ChevronLeft size={16} /> Anterior</Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setKnown({ ...known, [card.id]: false }); go(1); }}>Repasar</Button>
              <Button onClick={() => { setKnown({ ...known, [card.id]: true }); go(1); }}><Check size={16} /> La sé</Button>
            </div>
            <Button variant="ghost" onClick={() => go(1)}>Siguiente <ChevronRight size={16} /></Button>
          </div>
        </>
      )}
    </div>
  );
}

function Glossary({ initial }: { initial: string }) {
  const species = useSpecies();
  const [q, setQ] = useState(initial);
  const [cat, setCat] = useState('');
  const cats = [...new Set(species.glossary.map((g) => g.category))];
  const list = species.glossary
    .filter((g) => (!cat || g.category === cat) && (!q || normalize(g.term + ' ' + g.definition).includes(normalize(q))))
    .sort((a, b) => a.term.localeCompare(b.term, 'es'));
  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr,220px]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar término…" className={inputCls} aria-label="Buscar en el glosario" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={inputCls} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {cats.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>
      <dl className="grid gap-3 md:grid-cols-2">
        {list.map((g) => (
          <div key={g.term} className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
            <dt className="flex items-center justify-between font-semibold text-ink-900 dark:text-white">{g.term}<span className="text-[10px] font-normal uppercase tracking-wide text-ink-400">{g.category}</span></dt>
            <dd className="mt-1 text-sm text-ink-600 dark:text-ink-300">{g.definition}</dd>
          </div>
        ))}
      </dl>
      {list.length === 0 && <EmptyState title="Sin resultados en el glosario." />}
    </div>
  );
}

function Review() {
  const data = useProgress((s) => s.data);
  const byId = useStructureMap();
  const mastery = masteryBySystem(data);
  const errors = new Map<string, number>();
  for (const a of data.attempts) for (const it of a.items) if (!it.correct && it.structureId) errors.set(it.structureId, (errors.get(it.structureId) ?? 0) + 1);
  const toReview = [...errors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  const weak = (Object.entries(mastery) as [SystemId, { pct: number; total: number }][]).filter(([, m]) => m.pct < 70).sort((a, b) => a[1].pct - b[1].pct);

  if (!data.attempts.length) return <EmptyState title="Aún no hay material de repaso">Realiza cuestionarios y aquí aparecerán las estructuras y sistemas en los que más te equivocas.</EmptyState>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Estructuras para repasar">
        {toReview.length === 0 ? <p className="text-sm text-ink-500">¡Sin errores registrados en estructuras!</p> : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {toReview.map(([id, n]) => byId.get(id) && (
              <li key={id} className="flex items-center justify-between py-2 text-sm">
                <Link to={`/fichas/${id}`} className="font-medium hover:underline">{byId.get(id)!.name}</Link>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-red-500">{n} error{n > 1 ? 'es' : ''}</span>
                  <Link to={`/explorador?s=${id}`} className="text-xs text-brand-600 hover:underline dark:text-brand-300">Ver en 3D</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Sistemas que necesitan refuerzo">
        {weak.length === 0 ? <p className="text-sm text-ink-500">Todos los sistemas evaluados superan el 70 %.</p> : (
          <ul className="space-y-3">
            {weak.map(([sys, m]) => (
              <li key={sys}>
                <div className="mb-1 flex justify-between text-sm"><span>{SYSTEM_BY_ID[sys].name}</span><span className="tabular-nums text-ink-500">{Math.round(m.pct)} %</span></div>
                <ProgressBar value={m.pct} color={SYSTEM_BY_ID[sys].color} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
