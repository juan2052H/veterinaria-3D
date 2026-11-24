import {
  Camera, Crosshair, Eye, Focus, Layers, Maximize2, Minimize2, RotateCcw, Scissors, ScanEye, Tag, Ghost,
} from 'lucide-react';
import { useViewer, type ViewName, type ClipPlane } from './viewerStore';
import { glRef } from './AnatomyViewer';
import { cx } from '../components/ui';

const VIEWS: { id: ViewName; label: string; title: string }[] = [
  { id: 'lateral_derecha', label: 'Lat. D', title: 'Vista lateral derecha' },
  { id: 'lateral_izquierda', label: 'Lat. I', title: 'Vista lateral izquierda' },
  { id: 'dorsal', label: 'Dorsal', title: 'Vista dorsal' },
  { id: 'ventral', label: 'Ventral', title: 'Vista ventral' },
  { id: 'craneal', label: 'Craneal', title: 'Vista craneal (frontal)' },
  { id: 'caudal', label: 'Caudal', title: 'Vista caudal' },
];

function ToolButton({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cx(
        'grid h-8 w-8 place-items-center rounded-md transition',
        active ? 'bg-brand-500 text-white' : 'text-ink-200 hover:bg-white/10 hover:text-white',
      )}
    >
      {children}
    </button>
  );
}

export function ViewerToolbar({ minimal = false }: { minimal?: boolean }) {
  const s = useViewer();
  const screenshot = () => {
    const gl = glRef.current;
    if (!gl) return;
    const a = document.createElement('a');
    a.href = gl.domElement.toDataURL('image/png');
    a.download = `vetanatomia-captura-${Date.now()}.png`;
    a.click();
  };
  const cycleLabels = () => s.set({ labels: s.labels === 'none' ? 'selected' : s.labels === 'selected' ? 'all' : 'none' });

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-ink-950/80 p-1 shadow-xl backdrop-blur">
      <div className="flex items-center gap-0.5 pr-1">
        {VIEWS.map((v) => (
          <button key={v.id} onClick={() => s.camera({ kind: 'view', view: v.id })} title={v.title}
            className="rounded-md px-2 py-1.5 text-[11px] font-medium text-ink-200 hover:bg-white/10 hover:text-white">
            {v.label}
          </button>
        ))}
      </div>
      <div className="h-6 w-px bg-white/10" />
      <ToolButton onClick={() => s.camera({ kind: 'fit' })} title="Centrar modelo"><Crosshair size={16} /></ToolButton>
      <ToolButton onClick={s.resetView} title="Restablecer vista y capas"><RotateCcw size={16} /></ToolButton>
      {!minimal && (
        <>
          <div className="h-6 w-px bg-white/10" />
          <ToolButton active={s.transparentAll} onClick={() => s.set({ transparentAll: !s.transparentAll })} title="Modo transparente"><Ghost size={16} /></ToolButton>
          <ToolButton active={s.xray} onClick={() => s.set({ xray: !s.xray })} title="Rayos X: atenuar todo excepto la estructura seleccionada"><ScanEye size={16} /></ToolButton>
          <ToolButton active={s.isolate} onClick={() => s.set({ isolate: !s.isolate })} title="Aislar estructura seleccionada"><Focus size={16} /></ToolButton>
          <ToolButton active={s.labels !== 'none'} onClick={cycleLabels} title={`Etiquetas: ${s.labels === 'none' ? 'ocultas' : s.labels === 'selected' ? 'selección' : 'todas'}`}>
            <Tag size={16} />
            <span className="sr-only">{s.labels}</span>
          </ToolButton>
          <ToolButton active={s.clip.enabled} onClick={() => s.setClip({ enabled: !s.clip.enabled })} title="Cortes anatómicos por planos"><Scissors size={16} /></ToolButton>
          <ToolButton active={s.layerCompare.enabled} onClick={() => s.setLayerCompare({ enabled: !s.layerCompare.enabled })} title="Comparar capas anatómicas"><Layers size={16} /></ToolButton>
          <ToolButton onClick={() => s.unhideAll()} title="Mostrar estructuras ocultas"><Eye size={16} /></ToolButton>
          <ToolButton onClick={screenshot} title="Capturar imagen"><Camera size={16} /></ToolButton>
          <ToolButton active={s.focusMode} onClick={() => s.set({ focusMode: !s.focusMode })} title={s.focusMode ? 'Salir del modo sin distracciones' : 'Modo de estudio sin distracciones'}>
            {s.focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </ToolButton>
        </>
      )}
    </div>
  );
}

const PLANES: { id: ClipPlane; label: string }[] = [
  { id: 'sagital', label: 'Sagital' },
  { id: 'transversal', label: 'Transversal' },
  { id: 'dorsal', label: 'Dorsal' },
];

/** Controles del corte anatómico; aparece cuando el corte está activo. */
export function ClipControls() {
  const clip = useViewer((s) => s.clip);
  const setClip = useViewer((s) => s.setClip);
  if (!clip.enabled) return null;
  return (
    <div className="pointer-events-auto w-64 rounded-xl border border-white/10 bg-ink-950/85 p-3 text-xs text-ink-100 shadow-xl backdrop-blur animate-fadein">
      <div className="mb-2 font-semibold">Corte por plano</div>
      <div className="mb-2 flex gap-1">
        {PLANES.map((p) => (
          <button key={p.id} onClick={() => setClip({ plane: p.id })}
            className={cx('flex-1 rounded-md px-2 py-1', clip.plane === p.id ? 'bg-brand-500 text-white' : 'bg-white/5 hover:bg-white/10')}>
            {p.label}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="text-ink-300">Posición del plano</span>
        <input type="range" min={0} max={1} step={0.005} value={clip.pos} onChange={(e) => setClip({ pos: +e.target.value })} className="w-full accent-brand-500" />
      </label>
      <label className="mt-1 flex items-center gap-2">
        <input type="checkbox" checked={clip.flip} onChange={(e) => setClip({ flip: e.target.checked })} className="accent-brand-500" />
        Invertir lado conservado
      </label>
    </div>
  );
}
