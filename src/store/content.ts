import { create } from 'zustand';
import { useMemo } from 'react';
import { storage } from '../services/storage';
import { getSpecies } from '../core/registry';
import { generateQuestions } from '../quiz/engine';
import type { AnatomicalStructure, MeshMap, ModelSource, Question } from '../core/types';
import { useSettings } from './settings';

/**
 * Contenido editable desde el panel de administración: preguntas propias,
 * correcciones de fichas y mapeo de modelos GLB. Se guarda por especie.
 */
export type StructureOverride = Partial<Pick<AnatomicalStructure,
  'description' | 'location' | 'function' | 'clinical' | 'imageUrl' | 'reviewStatus' | 'commonName'>>;

interface ContentData {
  customQuestions: Question[];
  overrides: Record<string, StructureOverride>;
  meshMap: MeshMap;
}

interface ContentState {
  bySpecies: Record<string, ContentData>;
  /** Modelo GLB importado en esta sesión (URL de objeto; no persiste al recargar). */
  imported: { speciesId: string; url: string; fileName: string } | null;
  addQuestion: (speciesId: string, q: Question) => void;
  removeQuestion: (speciesId: string, id: string) => void;
  setOverride: (speciesId: string, structureId: string, o: StructureOverride | null) => void;
  setMeshMap: (speciesId: string, map: MeshMap) => void;
  setImported: (v: ContentState['imported']) => void;
}

const emptyData = (): ContentData => ({ customQuestions: [], overrides: {}, meshMap: {} });

export const useContent = create<ContentState>((set, get) => {
  const update = (speciesId: string, fn: (d: ContentData) => ContentData) => {
    const cur = get().bySpecies[speciesId] ?? storage.get<ContentData>(`content:${speciesId}`, emptyData());
    const next = fn({ ...emptyData(), ...cur });
    storage.set(`content:${speciesId}`, next);
    set({ bySpecies: { ...get().bySpecies, [speciesId]: next } });
  };
  return {
    bySpecies: { dog: { ...emptyData(), ...storage.get<Partial<ContentData>>('content:dog', {}) } },
    imported: null,
    addQuestion: (sp, q) => update(sp, (d) => ({ ...d, customQuestions: [...d.customQuestions, q] })),
    removeQuestion: (sp, id) => update(sp, (d) => ({ ...d, customQuestions: d.customQuestions.filter((q) => q.id !== id) })),
    setOverride: (sp, sid, o) =>
      update(sp, (d) => {
        const overrides = { ...d.overrides };
        if (o) overrides[sid] = o;
        else delete overrides[sid];
        return { ...d, overrides };
      }),
    setMeshMap: (sp, meshMap) => update(sp, (d) => ({ ...d, meshMap })),
    setImported: (imported) => {
      const prev = get().imported;
      if (prev && prev.url !== imported?.url) URL.revokeObjectURL(prev.url);
      set({ imported });
    },
  };
});

/* ------------------------------ Hooks de acceso ------------------------------ */

export function useSpecies() {
  const id = useSettings((s) => s.speciesId);
  return getSpecies(id);
}

const EMPTY: ContentData = Object.freeze(emptyData()) as ContentData;

function useContentData(speciesId: string): ContentData {
  return useContent((s) => s.bySpecies[speciesId]) ?? EMPTY;
}

/** Fichas de la especie actual con las correcciones del administrador aplicadas. */
export function useStructures(): AnatomicalStructure[] {
  const species = useSpecies();
  const { overrides } = useContentData(species.id);
  return useMemo(
    () => species.structures.map((s) => (overrides[s.id] ? { ...s, ...overrides[s.id] } : s)),
    [species, overrides],
  );
}

export function useStructureMap(): Map<string, AnatomicalStructure> {
  const list = useStructures();
  return useMemo(() => new Map(list.map((s) => [s.id, s])), [list]);
}

/** Banco completo: preguntas redactadas + generadas + propias del administrador. */
export function useQuestionPool(): Question[] {
  const species = useSpecies();
  const structures = useStructures();
  const { customQuestions } = useContentData(species.id);
  return useMemo(
    () => [...species.questions, ...generateQuestions(structures), ...customQuestions],
    [species, structures, customQuestions],
  );
}

/** Modelos disponibles: los del manifiesto más el GLB importado en la sesión. */
export function useModels(): ModelSource[] {
  const species = useSpecies();
  const imported = useContent((s) => s.imported);
  const { meshMap } = useContentData(species.id);
  return useMemo(() => {
    const list = [...species.models];
    if (imported && imported.speciesId === species.id) {
      list.push({
        kind: 'glb', label: `Importado: ${imported.fileName}`, url: imported.url, meshMap,
        disclaimer: 'Modelo importado por el administrador. Verifique su procedencia, licencia y validación anatómica.',
      });
    }
    return list;
  }, [species, imported, meshMap]);
}
