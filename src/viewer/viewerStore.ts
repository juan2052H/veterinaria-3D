import { create } from 'zustand';
import { peelStepFor, SYSTEMS, SYSTEM_BY_ID } from '../core/systems';
import type { Sex, SystemId } from '../core/types';

export type ViewName = 'lateral_derecha' | 'lateral_izquierda' | 'dorsal' | 'ventral' | 'craneal' | 'caudal' | 'iso';
export type ClipPlane = 'sagital' | 'transversal' | 'dorsal';
export type LabelMode = 'none' | 'selected' | 'all';

export type CameraInput = { kind: 'view'; view: ViewName } | { kind: 'focus'; meshName: string } | { kind: 'fit' };
export type CameraCommand = CameraInput & { n: number };

const all = <T,>(v: T) => Object.fromEntries(SYSTEMS.map((s) => [s.id, v])) as Record<SystemId, T>;

const DEFAULT_VISIBLE: Record<SystemId, boolean> = {
  ...all(true),
  subcutaneo: false,
  muscular: false,
};
const DEFAULT_OPACITY: Record<SystemId, number> = { ...all(1), integumentario: 0.16, subcutaneo: 0.35 };

export interface ViewerState {
  visible: Record<SystemId, boolean>;
  opacity: Record<SystemId, number>;
  hidden: Record<string, true>;
  peel: number;
  sex: Sex;
  selectedMesh: string | null;
  selectedId: string | null;
  hoveredMesh: string | null;
  isolate: boolean;
  xray: boolean;
  transparentAll: boolean;
  labels: LabelMode;
  compareSides: boolean;
  clip: { enabled: boolean; plane: ClipPlane; pos: number; flip: boolean };
  layerCompare: { enabled: boolean; a: SystemId; b: SystemId; t: number };
  camCmd: CameraCommand | null;
  modelIndex: number;
  focusMode: boolean;
  /** Índice estructura → nombres de malla (lo llena el modelo al cargarse). */
  meshIndex: Record<string, string[]>;
  /** Índice estructura → profundidad en la exploración por capas. */
  depthIndex: Record<string, number>;
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
  quiz: { active: boolean; correctId?: string; wrongMesh?: string };

  toggleSystem: (id: SystemId) => void;
  setSystemVisible: (id: SystemId, v: boolean) => void;
  soloSystem: (id: SystemId) => void;
  showAllSystems: () => void;
  setOpacity: (id: SystemId, v: number) => void;
  setPeel: (n: number) => void;
  setSex: (s: Sex) => void;
  select: (meshName: string | null, structureId: string | null) => void;
  selectStructure: (structureId: string, opts?: { side?: 'l' | 'r'; focus?: boolean; system?: SystemId; sex?: Sex }) => void;
  hover: (meshName: string | null) => void;
  hideStructure: (id: string) => void;
  unhideAll: () => void;
  set: (patch: Partial<ViewerState>) => void;
  camera: (cmd: CameraInput) => void;
  setClip: (patch: Partial<ViewerState['clip']>) => void;
  setLayerCompare: (patch: Partial<ViewerState['layerCompare']>) => void;
  resetView: () => void;
  enterQuizMode: (targetSystem: SystemId, sex?: Sex) => void;
  exitQuizMode: () => void;
}

const baseState = () => ({
  visible: { ...DEFAULT_VISIBLE },
  opacity: { ...DEFAULT_OPACITY },
  hidden: {} as Record<string, true>,
  peel: 0,
  selectedMesh: null,
  selectedId: null,
  hoveredMesh: null,
  isolate: false,
  xray: false,
  transparentAll: false,
  labels: 'selected' as LabelMode,
  compareSides: false,
  clip: { enabled: false, plane: 'sagital' as ClipPlane, pos: 0.5, flip: false },
  layerCompare: { enabled: false, a: 'muscular' as SystemId, b: 'oseo' as SystemId, t: 0.5 },
  quiz: { active: false },
});

let cmdCounter = 0;

export const useViewer = create<ViewerState>((set, get) => ({
  ...baseState(),
  sex: 'male',
  camCmd: null,
  modelIndex: 0,
  focusMode: false,
  meshIndex: {},
  depthIndex: {},
  bounds: null,

  toggleSystem: (id) => set((s) => ({ visible: { ...s.visible, [id]: !s.visible[id] } })),
  setSystemVisible: (id, v) => set((s) => ({ visible: { ...s.visible, [id]: v } })),
  soloSystem: (id) => set(() => ({ visible: { ...all(false), [id]: true }, peel: 0 })),
  showAllSystems: () => set(() => ({ visible: all(true), peel: 0 })),
  setOpacity: (id, v) => set((s) => ({ opacity: { ...s.opacity, [id]: v } })),
  setPeel: (peel) => set({ peel }),
  setSex: (sex) => set({ sex }),
  select: (selectedMesh, selectedId) => set({ selectedMesh, selectedId }),
  selectStructure: (structureId, opts = {}) => {
    const s = get();
    const meshes = s.meshIndex[structureId] ?? [];
    const preferred =
      meshes.find((m) => (opts.side ? m.includes(`__${opts.side}`) : m.includes('__r'))) ??
      meshes.find((m) => !opts.sex || !m.includes('@') || m.endsWith(`@${opts.sex}`)) ??
      meshes[0] ??
      null;
    const patch: Partial<ViewerState> = { selectedMesh: preferred, selectedId: structureId };
    const hidden = { ...s.hidden };
    delete hidden[structureId];
    patch.hidden = hidden;
    if (opts.system) {
      patch.visible = { ...s.visible, [opts.system]: true };
      patch.peel = Math.min(s.peel, peelStepFor(s.depthIndex[structureId] ?? SYSTEM_BY_ID[opts.system].depth));
      if (s.opacity[opts.system] < 0.3) patch.opacity = { ...s.opacity, [opts.system]: 1 };
    }
    if (opts.sex) patch.sex = opts.sex;
    // Al enfocar desde el buscador, atenuar el resto para que las estructuras profundas no queden tapadas.
    if (opts.focus && !s.quiz.active) patch.xray = true;
    set(patch);
    if (opts.focus && preferred) get().camera({ kind: 'focus', meshName: preferred });
  },
  hover: (hoveredMesh) => {
    if (get().hoveredMesh !== hoveredMesh) set({ hoveredMesh });
  },
  hideStructure: (id) =>
    set((s) => ({ hidden: { ...s.hidden, [id]: true }, ...(s.selectedId === id ? { selectedId: null, selectedMesh: null } : {}) })),
  unhideAll: () => set({ hidden: {} }),
  set: (patch) => set(patch),
  camera: (cmd) => set({ camCmd: { ...cmd, n: ++cmdCounter } }),
  setClip: (patch) => set((s) => ({ clip: { ...s.clip, ...patch } })),
  setLayerCompare: (patch) => set((s) => ({ layerCompare: { ...s.layerCompare, ...patch } })),
  resetView: () => {
    set({ ...baseState() });
    get().camera({ kind: 'view', view: 'iso' });
  },
  enterQuizMode: (targetSystem, sex) => {
    const visible = { ...all(false), [targetSystem]: true };
    const opacity = { ...DEFAULT_OPACITY, [targetSystem]: 1 };
    if (targetSystem !== 'oseo') {
      visible.oseo = true;
      opacity.oseo = 0.22;
    }
    set({
      ...baseState(),
      visible,
      opacity,
      labels: 'none',
      quiz: { active: true },
      ...(sex ? { sex } : {}),
    });
  },
  exitQuizMode: () => set({ ...baseState() }),
}));

// Solo en desarrollo: permite a los scripts de captura (verificación visual) controlar el visor.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __vet3dViewer: typeof useViewer }).__vet3dViewer = useViewer;
}
