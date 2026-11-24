import { useState } from 'react';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';
import { PEEL_STEPS, SYSTEMS } from '../core/systems';
import type { SystemId } from '../core/types';
import { useModels } from '../store/content';
import { useViewer } from './viewerStore';
import { cx } from '../components/ui';

/** Control de visibilidad y opacidad por sistema, exploración por capas, sexo y modelo. */
export function SystemPanel() {
  const s = useViewer();
  const models = useModels();
  const [expanded, setExpanded] = useState<SystemId | null>(null);
  const hiddenCount = Object.keys(s.hidden).length;

  return (
    <div className="space-y-5 text-sm">
      {models.length > 1 && (
        <section>
          <h3 className="panel-title">Modelo</h3>
          <select value={s.modelIndex} onChange={(e) => s.set({ modelIndex: +e.target.value, selectedId: null, selectedMesh: null })}
            className="w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-850">
            {models.map((m, i) => <option key={m.label} value={i}>{m.label}</option>)}
          </select>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="panel-title mb-0">Sistemas anatómicos</h3>
          <button onClick={s.showAllSystems} className="text-xs text-brand-600 hover:underline dark:text-brand-300">Mostrar todos</button>
        </div>
        <ul className="space-y-0.5">
          {SYSTEMS.map((sys) => {
            const on = s.visible[sys.id];
            const peeled = sys.depth < PEEL_STEPS[s.peel].depth;
            return (
              <li key={sys.id} className="rounded-lg hover:bg-ink-50 dark:hover:bg-ink-850">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <button onClick={() => s.toggleSystem(sys.id)} aria-pressed={on} aria-label={`${on ? 'Ocultar' : 'Mostrar'} ${sys.name}`}
                    className={cx('grid h-6 w-6 place-items-center rounded', on ? 'text-ink-700 dark:text-ink-100' : 'text-ink-400')}>
                    {on ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sys.color }} />
                  <button onClick={() => setExpanded(expanded === sys.id ? null : sys.id)}
                    className={cx('flex-1 text-left text-[13px]', (!on || peeled) && 'text-ink-400 line-through decoration-ink-300/50')}
                    title={peeled ? 'Retirado por la exploración por capas' : sys.description}>
                    {sys.name}
                  </button>
                  <button onClick={() => s.soloSystem(sys.id)} className="rounded px-1.5 text-[10px] font-medium uppercase text-ink-400 hover:bg-ink-200 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-100" title="Mostrar solo este sistema">
                    solo
                  </button>
                  <ChevronDown size={14} className={cx('text-ink-400 transition', expanded === sys.id && 'rotate-180')} />
                </div>
                {expanded === sys.id && (
                  <div className="px-3 pb-2 animate-fadein">
                    <label className="flex items-center gap-2 text-xs text-ink-500">
                      Opacidad
                      <input type="range" min={0.05} max={1} step={0.05} value={s.opacity[sys.id]}
                        onChange={(e) => s.setOpacity(sys.id, +e.target.value)} className="flex-1 accent-brand-500" aria-label={`Opacidad de ${sys.name}`} />
                      <span className="w-8 text-right tabular-nums">{Math.round(s.opacity[sys.id] * 100)}%</span>
                    </label>
                    <p className="mt-1 text-xs text-ink-500">{sys.description}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {hiddenCount > 0 && (
          <button onClick={s.unhideAll} className="mt-2 text-xs text-brand-600 hover:underline dark:text-brand-300">
            Mostrar {hiddenCount} estructura{hiddenCount > 1 ? 's' : ''} oculta{hiddenCount > 1 ? 's' : ''}
          </button>
        )}
      </section>

      <section>
        <h3 className="panel-title">Exploración por capas</h3>
        <input type="range" min={0} max={PEEL_STEPS.length - 1} step={1} value={s.peel} onChange={(e) => s.setPeel(+e.target.value)}
          className="w-full accent-brand-500" aria-label="Retirar capas anatómicas" />
        <div className="mt-1 flex justify-between text-[10px] text-ink-500"><span>Superficial</span><span>Profundo</span></div>
        <p className="mt-1 text-xs font-medium text-ink-700 dark:text-ink-200">{PEEL_STEPS[s.peel].label}</p>
      </section>

      {s.layerCompare.enabled && (
        <section className="rounded-lg border border-brand-500/30 bg-brand-50/50 p-3 dark:bg-brand-500/5">
          <h3 className="panel-title">Comparar capas</h3>
          <div className="grid grid-cols-2 gap-2">
            {(['a', 'b'] as const).map((k) => (
              <select key={k} value={s.layerCompare[k]} onChange={(e) => s.setLayerCompare({ [k]: e.target.value as SystemId })}
                className="rounded border border-ink-200 bg-white px-1 py-1 text-xs dark:border-ink-700 dark:bg-ink-850">
                {SYSTEMS.map((x) => <option key={x.id} value={x.id}>{x.shortName}</option>)}
              </select>
            ))}
          </div>
          <input type="range" min={0} max={1} step={0.01} value={s.layerCompare.t} onChange={(e) => s.setLayerCompare({ t: +e.target.value })}
            className="mt-2 w-full accent-brand-500" aria-label="Transición entre capas" />
          <div className="flex justify-between text-[10px] text-ink-500">
            <span>{SYSTEMS.find((x) => x.id === s.layerCompare.a)?.shortName}</span>
            <span>{SYSTEMS.find((x) => x.id === s.layerCompare.b)?.shortName}</span>
          </div>
        </section>
      )}

      <section>
        <h3 className="panel-title">Sexo del modelo</h3>
        <div className="flex gap-1 rounded-lg bg-ink-100 p-1 dark:bg-ink-850">
          {(['male', 'female'] as const).map((x) => (
            <button key={x} onClick={() => s.setSex(x)}
              className={cx('flex-1 rounded-md py-1 text-xs font-medium', s.sex === x ? 'bg-white shadow-sm dark:bg-ink-700' : 'text-ink-500')}>
              {x === 'male' ? 'Macho' : 'Hembra'}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
