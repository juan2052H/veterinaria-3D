import { useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Download, FileUp, Plus, Trash2 } from 'lucide-react';
import { GLTFLoader } from 'three-stdlib';
import type * as THREE from 'three';
import { useAuth } from '../store/auth';
import { useContent, useSpecies, useStructureMap, useStructures, type StructureOverride } from '../store/content';
import { SYSTEMS, SYSTEM_BY_ID } from '../core/systems';
import type { Level, MeshMap, Question, SystemId } from '../core/types';
import { parseMeshName } from '../viewer/meshResolver';
import { useViewer } from '../viewer/viewerStore';
import { downloadBlob, uid } from '../services/storage';
import { TYPE_LABEL } from '../quiz/engine';
import { Badge, Button, Card, EmptyState, Field, PageHeader, Tabs, inputCls } from '../components/ui';

type Tab = 'preguntas' | 'contenido' | 'modelo';

// Valores por defecto estables para los selectores de zustand.
const NO_QUESTIONS: Question[] = [];
const NO_OVERRIDES: Record<string, StructureOverride> = {};
const NO_MAP: MeshMap = {};

export default function AdminPage() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<Tab>('preguntas');
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader title="Administración de contenidos" subtitle="Gestiona preguntas, revisa fichas e incorpora modelos anatómicos 3D." />
      <div className="mb-6">
        <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'preguntas', label: 'Preguntas' }, { id: 'contenido', label: 'Fichas' }, { id: 'modelo', label: 'Modelo 3D' }]} />
      </div>
      {tab === 'preguntas' && <QuestionsAdmin />}
      {tab === 'contenido' && <ContentAdmin />}
      {tab === 'modelo' && <ModelAdmin />}
    </div>
  );
}

/* ------------------------------ Preguntas ------------------------------ */

function QuestionsAdmin() {
  const species = useSpecies();
  const structures = useStructures();
  const custom = useContent((s) => s.bySpecies[species.id]?.customQuestions ?? NO_QUESTIONS);
  const add = useContent((s) => s.addQuestion);
  const remove = useContent((s) => s.removeQuestion);
  const [type, setType] = useState<'multiple' | 'truefalse' | 'fill' | 'identify3d'>('multiple');
  const [f, setF] = useState({ prompt: '', explanation: '', topic: 'oseo' as SystemId, level: 'basico' as Level, structureId: '', options: ['', '', '', ''], answer: 0, tf: true, answers: '' });
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const base = { id: uid('cq_'), prompt: f.prompt.trim(), explanation: f.explanation.trim(), topic: f.topic, level: f.level, structureId: f.structureId || undefined };
    if (type !== 'identify3d' && base.prompt.length < 8) return setError('Escriba el enunciado de la pregunta.');
    if (base.explanation.length < 8) return setError('La explicación educativa es obligatoria.');
    let q: Question;
    if (type === 'multiple') {
      const options = f.options.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) return setError('Incluya al menos dos opciones.');
      if (new Set(options).size !== options.length) return setError('Las opciones no deben repetirse.');
      if (!f.options[f.answer]?.trim()) return setError('La opción marcada como correcta está vacía.');
      q = { ...base, type, options, answer: options.indexOf(f.options[f.answer].trim()) };
    } else if (type === 'truefalse') {
      q = { ...base, type, answer: f.tf };
    } else if (type === 'fill') {
      const answers = f.answers.split(',').map((a) => a.trim()).filter(Boolean);
      if (!answers.length) return setError('Indique al menos una respuesta aceptada.');
      q = { ...base, type, answers };
    } else {
      const st = structures.find((s) => s.id === f.structureId);
      if (!st) return setError('Seleccione la estructura que se debe identificar.');
      q = { ...base, type, structureId: st.id, topic: st.system, prompt: base.prompt || `Seleccione en el modelo 3D: ${st.name}` };
    }
    add(species.id, q);
    setF({ ...f, prompt: '', explanation: '', options: ['', '', '', ''], answers: '' });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
      <Card title="Nueva pregunta">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Tipo">
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={inputCls}>
              {(['multiple', 'truefalse', 'fill', 'identify3d'] as const).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label={type === 'identify3d' ? 'Enunciado (opcional)' : 'Enunciado'}><textarea rows={2} value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} className={inputCls} /></Field>
          {type === 'multiple' && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-medium text-ink-600 dark:text-ink-300">Opciones (marque la correcta)</legend>
              {f.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={f.answer === i} onChange={() => setF({ ...f, answer: i })} className="accent-brand-500" aria-label={`Opción ${i + 1} correcta`} />
                  <input value={o} onChange={(e) => { const options = [...f.options]; options[i] = e.target.value; setF({ ...f, options }); }} placeholder={`Opción ${String.fromCharCode(65 + i)}`} className={inputCls} />
                </div>
              ))}
            </fieldset>
          )}
          {type === 'truefalse' && (
            <Field label="Respuesta correcta">
              <select value={String(f.tf)} onChange={(e) => setF({ ...f, tf: e.target.value === 'true' })} className={inputCls}><option value="true">Verdadero</option><option value="false">Falso</option></select>
            </Field>
          )}
          {type === 'fill' && <Field label="Respuestas aceptadas (separadas por comas)"><input value={f.answers} onChange={(e) => setF({ ...f, answers: e.target.value })} className={inputCls} /></Field>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Sistema">
              <select value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value as SystemId })} className={inputCls} disabled={type === 'identify3d'}>
                {SYSTEMS.map((s) => <option key={s.id} value={s.id}>{s.shortName}</option>)}
              </select>
            </Field>
            <Field label="Nivel">
              <select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value as Level })} className={inputCls}>
                <option value="basico">Básico</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option>
              </select>
            </Field>
            <Field label={type === 'identify3d' ? 'Estructura *' : 'Estructura (opcional)'}>
              <select value={f.structureId} onChange={(e) => setF({ ...f, structureId: e.target.value })} className={inputCls}>
                <option value="">—</option>
                {structures.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Explicación educativa"><textarea rows={3} value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} className={inputCls} /></Field>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit"><Plus size={16} /> Añadir pregunta</Button>
        </form>
      </Card>
      <Card title={`Preguntas propias (${custom.length})`}>
        {custom.length === 0 ? <p className="text-sm text-ink-500">Las preguntas creadas aquí se suman al banco de cuestionarios.</p> : (
          <ul className="space-y-2">
            {custom.map((q) => (
              <li key={q.id} className="flex items-start gap-3 rounded-lg border border-ink-200 p-3 text-sm dark:border-ink-800">
                <div className="flex-1">
                  <div className="font-medium">{q.prompt}</div>
                  <div className="mt-1 flex gap-1.5"><Badge>{TYPE_LABEL[q.type]}</Badge><Badge>{SYSTEM_BY_ID[q.topic].shortName}</Badge></div>
                </div>
                <button onClick={() => remove(species.id, q.id)} className="text-ink-400 hover:text-red-500" aria-label="Eliminar pregunta"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------ Fichas ------------------------------ */

function ContentAdmin() {
  const species = useSpecies();
  const structures = useStructures();
  const overrides = useContent((s) => s.bySpecies[species.id]?.overrides ?? NO_OVERRIDES);
  const setOverride = useContent((s) => s.setOverride);
  const [id, setId] = useState(structures[0]?.id ?? '');
  const s = structures.find((x) => x.id === id)!;
  const [draft, setDraft] = useState<StructureOverride>({});
  const val = <K extends keyof StructureOverride>(k: K) => (draft[k] ?? s?.[k] ?? '') as string;
  const reviewed = structures.filter((x) => x.reviewStatus === 'revisado').length;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
      <Card title="Estado de revisión">
        <p className="mb-3 text-sm text-ink-500">{reviewed} de {structures.length} fichas revisadas por un docente.</p>
        <ul className="max-h-[520px] space-y-0.5 overflow-y-auto text-sm">
          {structures.map((x) => (
            <li key={x.id}>
              <button onClick={() => { setId(x.id); setDraft({}); }} className={`flex w-full items-center justify-between rounded px-2 py-1 text-left ${x.id === id ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-ink-50 dark:hover:bg-ink-850'}`}>
                <span className="truncate">{x.name}</span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${x.reviewStatus === 'revisado' ? 'bg-green-500' : 'bg-amber-400'}`} />
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {s && (
        <Card title={s.name} action={overrides[s.id] && <Badge color="#3b82f6">Con correcciones</Badge>}>
          <div className="space-y-3">
            {(['description', 'location', 'function', 'clinical'] as const).map((k) => (
              <Field key={k} label={{ description: 'Descripción', location: 'Localización', function: 'Función', clinical: 'Importancia clínica' }[k]}>
                <textarea rows={3} value={val(k)} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className={inputCls} />
              </Field>
            ))}
            <Field label="URL de imagen de referencia (con licencia adecuada)"><input value={val('imageUrl')} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} className={inputCls} /></Field>
            <Field label="Estado">
              <select value={val('reviewStatus')} onChange={(e) => setDraft({ ...draft, reviewStatus: e.target.value as 'borrador' | 'revisado' })} className={inputCls}>
                <option value="borrador">Pendiente de revisión docente</option><option value="revisado">Revisado por docente</option>
              </select>
            </Field>
            <div className="flex gap-2">
              <Button onClick={() => { setOverride(species.id, s.id, { ...overrides[s.id], ...draft }); setDraft({}); }} disabled={!Object.keys(draft).length}>Guardar cambios</Button>
              {overrides[s.id] && <Button variant="ghost" onClick={() => { setOverride(species.id, s.id, null); setDraft({}); }}>Restaurar original</Button>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------ Modelo 3D ------------------------------ */

function ModelAdmin() {
  const species = useSpecies();
  const structures = useStructures();
  const byId = useStructureMap();
  const savedMap = useContent((s) => s.bySpecies[species.id]?.meshMap ?? NO_MAP);
  const setMeshMap = useContent((s) => s.setMeshMap);
  const setImported = useContent((s) => s.setImported);
  const navigate = useNavigate();
  const [file, setFile] = useState<{ name: string; url: string } | null>(null);
  const [meshNames, setMeshNames] = useState<string[]>([]);
  const [map, setMap] = useState<MeshMap>(savedMap);
  const [status, setStatus] = useState('');

  const load = (f: File) => {
    if (!/\.(glb|gltf)$/i.test(f.name)) return setStatus('Seleccione un archivo .glb o .gltf.');
    const url = URL.createObjectURL(f);
    setStatus('Leyendo modelo…');
    new GLTFLoader().load(url, (gltf) => {
      const names: string[] = [];
      gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) names.push(o.name || o.parent?.name || '(sin nombre)'); });
      setMeshNames(names);
      setFile({ name: f.name, url });
      setStatus(`${names.length} mallas encontradas.`);
    }, undefined, (err) => setStatus(`No se pudo leer el archivo: ${(err as unknown as Error).message ?? err}`));
  };

  const resolved = (name: string) => map[name]?.structureId ?? (byId.has(parseMeshName(name).structureId) ? parseMeshName(name).structureId : '');
  const mappedIds = useMemo(() => new Set(meshNames.map(resolved).filter(Boolean)), [meshNames, map]); // eslint-disable-line react-hooks/exhaustive-deps
  const missing = structures.filter((s) => !mappedIds.has(s.id));

  return (
    <div className="space-y-6">
      <Card title="Importar modelo anatómico (GLB/GLTF)">
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Cargue un modelo y asocie cada malla con su ficha. Las mallas nombradas con la convención <code>&lt;id&gt;__l</code> / <code>&lt;id&gt;__r</code> (p. ej. <code>femur__l</code>) se asocian automáticamente.
          Verifique que el modelo tenga una licencia adecuada para uso educativo y que su precisión anatómica haya sido validada.
        </p>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
          <FileUp size={16} /> Seleccionar archivo
          <input type="file" accept=".glb,.gltf" className="sr-only" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
        </label>
        {status && <p className="mt-2 text-sm text-ink-500" role="status">{status}</p>}
      </Card>

      {file && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><div className="text-xs text-ink-500">Mallas</div><div className="text-2xl font-semibold">{meshNames.length}</div></Card>
            <Card><div className="text-xs text-ink-500">Mallas asociadas</div><div className="text-2xl font-semibold">{meshNames.filter(resolved).length}</div></Card>
            <Card><div className="text-xs text-ink-500">Fichas sin malla</div><div className="text-2xl font-semibold">{missing.length}</div></Card>
          </div>
          <Card title="Asociación malla → ficha" action={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => downloadBlob(`meshmap-${species.id}.json`, JSON.stringify(map, null, 2), 'application/json')}><Download size={14} /> Exportar JSON</Button>
              <Button size="sm" onClick={() => {
                setMeshMap(species.id, map);
                setImported({ speciesId: species.id, url: file.url, fileName: file.name });
                useViewer.setState({ modelIndex: species.models.length });
                navigate('/explorador');
              }}>Usar en el explorador</Button>
            </div>
          }>
            <div className="max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-xs text-ink-500 dark:bg-ink-900"><tr><th className="py-2">Malla</th><th className="py-2">Ficha asociada</th><th className="py-2">Lado</th></tr></thead>
                <tbody>
                  {meshNames.map((n, i) => (
                    <tr key={n + i} className="border-t border-ink-100 dark:border-ink-800">
                      <td className="py-1.5 pr-3 font-mono text-xs">{n}</td>
                      <td className="py-1.5 pr-3">
                        <select value={resolved(n)} onChange={(e) => setMap({ ...map, [n]: { ...map[n], structureId: e.target.value } })} className={`${inputCls} py-1`}>
                          <option value="">— Sin asociar —</option>
                          {structures.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5">
                        <select value={map[n]?.side ?? parseMeshName(n).side ?? ''} onChange={(e) => setMap({ ...map, [n]: { structureId: resolved(n), side: (e.target.value || undefined) as 'l' | 'r' | undefined } })} className={`${inputCls} py-1`}>
                          <option value="">—</option><option value="l">Izq.</option><option value="r">Der.</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {missing.length > 0 && (
            <Card title="Fichas sin malla en este modelo">
              <div className="flex flex-wrap gap-1.5">{missing.map((s) => <Badge key={s.id}>{s.name}</Badge>)}</div>
            </Card>
          )}
        </>
      )}
      {!file && <EmptyState title="Ningún modelo cargado">El explorador usa el modelo esquemático provisional hasta que se incorpore un modelo anatómico validado.</EmptyState>}
    </div>
  );
}
