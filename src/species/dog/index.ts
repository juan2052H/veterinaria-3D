import type { SpeciesManifest } from '../../core/types';
import { DOG_STRUCTURES } from './structures';
import { DOG_QUESTIONS } from './questions';
import { DOG_GLOSSARY } from './glossary';
import { DOG_GUIDED_PATH } from './guidedPath';
import { buildDogSchematic, buildDogSchematicAsync, SCHEMATIC_DISCLAIMER } from './schematicModel';
import { DOG_GLB_MESHMAP } from './meshMap';

export const dog: SpeciesManifest = {
  id: 'dog',
  name: 'Perro',
  scientificName: 'Canis lupus familiaris',
  available: true,
  description: 'Primera especie del laboratorio: 12 sistemas anatómicos, fichas, glosario, estudio guiado y evaluaciones.',
  models: [
    { kind: 'procedural', label: 'Esquemático provisional', disclaimer: SCHEMATIC_DISCLAIMER, build: buildDogSchematic, buildAsync: buildDogSchematicAsync },
    // Para usar un modelo anatómico real: colocar el archivo en public/models/dog/ y descomentar.
    // { kind: 'glb', label: 'Modelo anatómico (GLB)', url: '/models/dog/dog-anatomy.glb', meshMap: DOG_GLB_MESHMAP },
  ],
  structures: DOG_STRUCTURES,
  questions: DOG_QUESTIONS,
  glossary: DOG_GLOSSARY,
  guidedPath: DOG_GUIDED_PATH,
};

/** Exportado para el importador de modelos del panel de administración. */
export { DOG_GLB_MESHMAP };
