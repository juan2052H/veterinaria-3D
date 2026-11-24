import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Box, Columns2, Star } from 'lucide-react';
import { SYSTEMS, SYSTEM_BY_ID } from '../core/systems';
import type { AnatomicalStructure, Level, SystemId } from '../core/types';
import { useStructureMap, useStructures } from '../store/content';
import { useProgress } from '../store/progress';
import { useStudyTimer } from '../lib/useStudyTimer';
import { normalize } from '../quiz/engine';
import { StructureInfo } from '../components/StructureInfo';
import { Button, Card, EmptyState, LevelBadge, PageHeader, SystemBadge, cx, inputCls } from '../components/ui';
import { BIBLIOGRAPHY } from '../core/bibliography';

export function StructuresListPage() {
  const structures = useStructures();
  const { favorites, viewed } = useProgress((s) => s.data);
  const [q, setQ] = useState('');
  const [system, setSystem] = useState<SystemId | ''>('');
  const [level, setLevel] = useState<Level | ''>('');
  const [onlyFav, setOnlyFav] = useState(false);
  const navigate = useNavigate();

  const list = useMemo(() => {
    const n = normalize(q);
    return structures.filter((s) =>
      (!n || [s.name, s.latinName, s.commonName ?? '', s.region].some((x) => normalize(x).includes(n))) &&
      (!system || s.system === system) && (!level || s.level === level) && (!onlyFav || favorites.includes(s.id)));
  }, [structures, q, system, level, onlyFav, favorites]);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="Fichas anatómicas"
        subtitle={`${structures.length} estructuras del perro con descripción, función, relaciones, importancia clínica y referencias.`}
        actions={<Button variant="secondary" onClick={() => navigate('/fichas/comparar')}><Columns2 size={16} /> Comparar estructuras</Button>}
      />
      <div className="mb-5 grid gap-3 md:grid-cols-[1fr,200px,160px,auto]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, nombre latino o región…" className={inputCls} aria-label="Buscar fichas" />
        <select value={system} onChange={(e) => setSystem(e.target.value as SystemId | '')} className={inputCls} aria-label="Filtrar por sistema">
          <option value="">Todos los sistemas</option>
          {SYSTEMS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value as Level | '')} className={inputCls} aria-label="Filtrar por nivel">
          <option value="">Todos los niveles</option>
          <option value="basico">Básico</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option>
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} className="accent-brand-500" /> Solo favoritos</label>
      </div>
      {list.length === 0 ? (
        <EmptyState title="No hay fichas que coincidan con los filtros." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((s) => (
            <Link key={s.id} to={`/fichas/${s.id}`} className="group rounded-xl border border-ink-200 bg-white p-4 transition hover:border-brand-400 hover:shadow-md dark:border-ink-800 dark:bg-ink-900">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-ink-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">{s.name}</div>
                  <div className="text-xs italic text-ink-500">{s.latinName}</div>
                </div>
                {favorites.includes(s.id) && <Star size={14} className="shrink-0 fill-amber-400 text-amber-400" />}
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-ink-600 dark:text-ink-400">{s.definition}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <SystemBadge id={s.system} />
                <LevelBadge level={s.level} />
                {viewed[s.id] && <span className="ml-auto text-[10px] text-ink-400">Consultada</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function StructureDetailPage() {
  useStudyTimer();
  const { id = '' } = useParams();
  const byId = useStructureMap();
  const s = byId.get(id);
  const { favorites } = useProgress((st) => st.data);
  const toggleFavorite = useProgress((st) => st.toggleFavorite);
  const markViewed = useProgress((st) => st.markViewed);
  const navigate = useNavigate();

  useEffect(() => {
    if (s) markViewed(s.id);
  }, [s, markViewed]);

  if (!s) return <div className="p-6"><EmptyState title="Ficha no encontrada" /></div>;
  const fav = favorites.includes(s.id);
  return (
    <div className="mx-auto max-w-4xl p-6">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800 dark:hover:text-ink-200"><ArrowLeft size={15} /> Volver</button>
      <PageHeader
        title={s.name}
        subtitle={<span className="italic">{s.latinName}{s.commonName ? ` — ${s.commonName}` : ''}</span>}
        actions={
          <>
            <Button variant="secondary" onClick={() => toggleFavorite(s.id)}><Star size={16} className={fav ? 'fill-amber-400 text-amber-400' : ''} /> {fav ? 'En favoritos' : 'Favorito'}</Button>
            <Button variant="secondary" onClick={() => navigate(`/fichas/comparar?a=${s.id}`)}><Columns2 size={16} /> Comparar</Button>
            <Button onClick={() => navigate(`/explorador?s=${s.id}`)}><Box size={16} /> Ver en 3D</Button>
          </>
        }
      />
      <Card><StructureInfo s={s} /></Card>
    </div>
  );
}

const ROWS: { label: string; get: (s: AnatomicalStructure) => React.ReactNode }[] = [
  { label: 'Nombre científico', get: (s) => <i>{s.latinName}</i> },
  { label: 'Sistema', get: (s) => SYSTEM_BY_ID[s.system].name },
  { label: 'Clasificación', get: (s) => s.classification },
  { label: 'Región', get: (s) => s.region },
  { label: 'Localización', get: (s) => s.location },
  { label: 'Función', get: (s) => s.function },
  { label: 'Características', get: (s) => <ul className="list-disc pl-4">{s.features.map((f) => <li key={f}>{f}</li>)}</ul> },
  { label: 'Relaciones', get: (s) => <ul className="list-disc pl-4">{s.relations.map((f) => <li key={f}>{f}</li>)}</ul> },
  { label: 'Importancia clínica', get: (s) => s.clinical },
  { label: 'Referencias', get: (s) => <span className="text-xs">{s.references.map((r) => BIBLIOGRAPHY[r]?.split('.')[0]).join('; ')}</span> },
];

export function ComparePage() {
  const structures = useStructures();
  const byId = useStructureMap();
  const [params, setParams] = useSearchParams();
  const a = byId.get(params.get('a') ?? '');
  const b = byId.get(params.get('b') ?? '');
  const pick = (k: 'a' | 'b', v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next, { replace: true });
  };
  const Select = ({ k, value }: { k: 'a' | 'b'; value?: string }) => (
    <select value={value ?? ''} onChange={(e) => pick(k, e.target.value)} className={inputCls} aria-label={`Estructura ${k === 'a' ? 'A' : 'B'}`}>
      <option value="">Seleccione una estructura…</option>
      {SYSTEMS.map((sys) => (
        <optgroup key={sys.id} label={sys.name}>
          {structures.filter((s) => s.system === sys.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader title="Comparación entre estructuras" subtitle="Contrasta ubicación, función, relaciones e importancia clínica de dos estructuras." />
      <div className="mb-4 grid gap-3 md:grid-cols-2"><Select k="a" value={a?.id} /><Select k="b" value={b?.id} /></div>
      {a && b ? (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 dark:border-ink-800">
                <th className="w-40 p-3 text-left text-xs font-medium text-ink-500" />
                <th className="p-3 text-left font-semibold">{a.name}</th>
                <th className="p-3 text-left font-semibold">{b.name}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className={cx('border-b border-ink-100 align-top last:border-0 dark:border-ink-800')}>
                  <th scope="row" className="p-3 text-left text-xs font-medium text-ink-500">{r.label}</th>
                  <td className="p-3 text-ink-700 dark:text-ink-200">{r.get(a)}</td>
                  <td className="p-3 text-ink-700 dark:text-ink-200">{r.get(b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Seleccione dos estructuras para compararlas." />
      )}
    </div>
  );
}
