import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, EyeOff, Focus, FileText, SplitSquareHorizontal, Star, X } from 'lucide-react';
import { useStructureMap } from '../store/content';
import { useProgress } from '../store/progress';
import { useViewer } from './viewerStore';
import { StructureInfo } from '../components/StructureInfo';
import { Button, cx, inputCls } from '../components/ui';

/** Panel informativo de la estructura seleccionada en el visor. */
export function StructurePanel() {
  const byId = useStructureMap();
  const selectedId = useViewer((s) => s.selectedId);
  const selectedMesh = useViewer((s) => s.selectedMesh);
  const compareSides = useViewer((s) => s.compareSides);
  const isolate = useViewer((s) => s.isolate);
  const v = useViewer();
  const favorites = useProgress((s) => s.data.favorites);
  const toggleFavorite = useProgress((s) => s.toggleFavorite);
  const addBookmark = useProgress((s) => s.addBookmark);
  const [note, setNote] = useState<string | null>(null);

  if (!selectedId) {
    return (
      <div className="p-5 text-sm text-ink-500">
        <p className="font-medium text-ink-700 dark:text-ink-200">Ninguna estructura seleccionada</p>
        <p className="mt-1">Haz clic sobre una estructura del modelo o búscala para consultar su ficha. Arrastra para rotar, usa la rueda para acercar y clic derecho para desplazar la cámara.</p>
      </div>
    );
  }
  if (!byId.get(selectedId)) {
    return <div className="p-5 text-sm text-ink-500">Malla sin ficha asociada: <code>{selectedMesh}</code></div>;
  }
  const s = byId.get(selectedId)!;
  const fav = favorites.includes(s.id);
  const side = selectedMesh?.includes('__l') ? 'izquierdo' : selectedMesh?.includes('__r') ? 'derecho' : null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-200 p-4 dark:border-ink-800">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight text-ink-900 dark:text-white">{s.name}</h2>
            <p className="text-xs italic text-ink-500">{s.latinName}{side ? ` · lado ${side}` : ''}</p>
          </div>
          <button onClick={() => v.select(null, null)} className="rounded p-1 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Cerrar ficha"><X size={16} /></button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <IconAction active={fav} onClick={() => toggleFavorite(s.id)} title={fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}><Star size={14} className={fav ? 'fill-current' : ''} /></IconAction>
          <IconAction onClick={() => setNote('')} title="Añadir marcador de estudio"><Bookmark size={14} /></IconAction>
          <IconAction active={isolate} onClick={() => v.set({ isolate: !isolate })} title="Aislar"><Focus size={14} /></IconAction>
          <IconAction onClick={() => v.hideStructure(s.id)} title="Ocultar estructura"><EyeOff size={14} /></IconAction>
          {s.bilateral && (
            <IconAction active={compareSides} onClick={() => v.set({ compareSides: !compareSides })} title="Comparar lado izquierdo y derecho">
              <SplitSquareHorizontal size={14} />
            </IconAction>
          )}
          <Link to={`/fichas/${s.id}`} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
            <FileText size={14} /> Ficha completa
          </Link>
        </div>
        {s.bilateral && compareSides && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
            Resaltado en ámbar: estructura contralateral. Ambos lados comparten morfología; compara su posición y relaciones.
          </p>
        )}
        {note !== null && (
          <div className="mt-3 space-y-2 animate-fadein">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota de estudio (opcional)" rows={2} className={inputCls} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { addBookmark(s.id, note.trim()); setNote(null); }}>Guardar marcador</Button>
              <Button size="sm" variant="ghost" onClick={() => setNote(null)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <StructureInfo s={s} compact onRelatedClick={(id) => {
          const r = byId.get(id);
          if (r) v.selectStructure(id, { focus: true, system: r.system, sex: r.sex });
        }} />
      </div>
    </div>
  );
}

function IconAction({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} aria-pressed={active}
      className={cx('grid h-7 w-7 place-items-center rounded-md border transition',
        active ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 text-ink-600 hover:border-brand-400 dark:border-ink-700 dark:text-ink-300')}>
      {children}
    </button>
  );
}
