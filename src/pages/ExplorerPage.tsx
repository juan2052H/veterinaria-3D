import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PanelLeft, PanelRight, Search } from 'lucide-react';
import { AnatomyViewer } from '../viewer/AnatomyViewer';
import { ViewerToolbar, ClipControls } from '../viewer/ViewerToolbar';
import { SystemPanel } from '../viewer/SystemPanel';
import { StructurePanel } from '../viewer/StructurePanel';
import { useViewer } from '../viewer/viewerStore';
import { useStructureMap, useStructures } from '../store/content';
import { useProgress } from '../store/progress';
import { useStudyTimer } from '../lib/useStudyTimer';
import { normalize } from '../quiz/engine';
import { SYSTEM_BY_ID } from '../core/systems';
import type { SystemId } from '../core/types';
import { cx } from '../components/ui';

export default function ExplorerPage() {
  useStudyTimer();
  const [params, setParams] = useSearchParams();
  const byId = useStructureMap();
  const selectedId = useViewer((s) => s.selectedId);
  const meshIndex = useViewer((s) => s.meshIndex);
  const focusMode = useViewer((s) => s.focusMode);
  const v = useViewer();
  const markViewed = useProgress((s) => s.markViewed);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const dark = document.documentElement.classList.contains('dark');

  // Salir del modo evaluación si se viene de un cuestionario
  useEffect(() => {
    if (useViewer.getState().quiz.active) useViewer.getState().exitQuizMode();
    return () => useViewer.setState({ focusMode: false, hoveredMesh: null });
  }, []);

  // Registrar estructuras consultadas
  useEffect(() => {
    if (selectedId && byId.has(selectedId)) {
      markViewed(selectedId);
      setRightOpen(true);
    }
  }, [selectedId, byId, markViewed]);

  // Parámetros de URL: ?s=<estructura>  ?systems=oseo,articular
  useEffect(() => {
    if (!Object.keys(meshIndex).length) return;
    const systems = params.get('systems');
    if (systems) {
      const list = systems.split(',') as SystemId[];
      v.set({ visible: Object.fromEntries(Object.keys(SYSTEM_BY_ID).map((id) => [id, list.includes(id as SystemId)])) as Record<SystemId, boolean>, peel: 0 });
    }
    const sid = params.get('s');
    if (sid && byId.has(sid)) {
      const st = byId.get(sid)!;
      v.selectStructure(sid, { focus: true, system: st.system, sex: st.sex });
    }
    if (systems || sid) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meshIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) {
        if (useViewer.getState().focusMode) v.set({ focusMode: false });
        else v.select(null, null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [v]);

  return (
    <div className="relative flex h-full min-h-[560px]">
      {!focusMode && leftOpen && (
        <aside className="absolute inset-y-0 left-0 z-20 w-72 shrink-0 overflow-y-auto border-r border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900 md:static">
          <SystemPanel />
        </aside>
      )}

      <div className="relative min-w-0 flex-1">
        <AnatomyViewer className="absolute inset-0" dark={dark} />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
          <div className="pointer-events-auto flex gap-2">
            {!focusMode && (
              <button onClick={() => setLeftOpen((o) => !o)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-ink-950/80 text-ink-200 backdrop-blur hover:text-white" aria-label="Mostrar u ocultar panel de sistemas" title="Panel de sistemas">
                <PanelLeft size={18} />
              </button>
            )}
            <StructureFinder />
          </div>
          <ViewerToolbar />
          {!focusMode && (
            <button onClick={() => setRightOpen((o) => !o)} className="pointer-events-auto grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-ink-950/80 text-ink-200 backdrop-blur hover:text-white" aria-label="Mostrar u ocultar panel de información" title="Panel de información">
              <PanelRight size={18} />
            </button>
          )}
        </div>
        <div className="pointer-events-none absolute bottom-16 right-3 sm:bottom-3 sm:right-36">
          <ClipControls />
        </div>
      </div>

      {rightOpen && (!focusMode || selectedId) && (
        <aside className={cx(
          'absolute inset-y-0 right-0 z-20 w-full max-w-sm shrink-0 overflow-hidden border-l border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900 lg:static lg:w-96',
          !selectedId && 'hidden lg:block',
        )}>
          <StructurePanel />
        </aside>
      )}
    </div>
  );
}

/** Buscador rápido de estructuras dentro del explorador. */
function StructureFinder() {
  const structures = useStructures();
  const selectStructure = useViewer((s) => s.selectStructure);
  const sex = useViewer((s) => s.sex);
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const n = normalize(q);
    if (n.length < 2) return [];
    return structures.filter((s) => normalize(s.name).includes(n) || normalize(s.latinName).includes(n) || normalize(s.commonName ?? '').includes(n)).slice(0, 8);
  }, [q, structures]);
  return (
    <div className="relative w-56 sm:w-64">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el modelo…" aria-label="Buscar estructura en el modelo"
        className="h-10 w-full rounded-xl border border-white/10 bg-ink-950/80 pl-9 pr-3 text-sm text-white placeholder:text-ink-400 backdrop-blur focus:border-brand-500 focus:outline-none" />
      {results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-white/10 bg-ink-950/95 text-sm text-ink-100 shadow-xl">
          {results.map((s) => (
            <li key={s.id}>
              <button className="block w-full px-3 py-2 text-left hover:bg-white/10"
                onClick={() => { selectStructure(s.id, { focus: true, system: s.system, sex: s.sex ?? sex }); setQ(''); }}>
                {s.name} <span className="text-xs text-ink-400">· {SYSTEM_BY_ID[s.system].shortName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
