import type { SpeciesManifest } from './types';
import { dog } from '../species/dog';

/**
 * Registro de especies. Para añadir una especie: crear `src/species/<id>/index.ts`
 * que exporte un `SpeciesManifest` y añadirlo a esta lista.
 */
const placeholder = (id: string, name: string, scientificName: string): SpeciesManifest => ({
  id, name, scientificName, available: false,
  description: 'Especie planificada. Aún no tiene modelo ni contenido.',
  models: [], structures: [], questions: [], glossary: [], guidedPath: [],
});

export const SPECIES: SpeciesManifest[] = [
  dog,
  placeholder('cat', 'Gato', 'Felis catus'),
  placeholder('horse', 'Caballo', 'Equus caballus'),
  placeholder('bovine', 'Bovino', 'Bos taurus'),
  placeholder('pig', 'Porcino', 'Sus scrofa domesticus'),
  placeholder('sheep', 'Ovino', 'Ovis aries'),
  placeholder('goat', 'Caprino', 'Capra hircus'),
  placeholder('bird', 'Aves (gallina)', 'Gallus gallus domesticus'),
];

export function getSpecies(id: string): SpeciesManifest {
  return SPECIES.find((s) => s.id === id && s.available) ?? dog;
}
