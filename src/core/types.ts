/**
 * Tipos centrales del dominio. Todo lo específico de una especie (estructuras,
 * modelo 3D, preguntas, glosario, rutas de estudio) se describe con estos tipos,
 * de modo que añadir una especie nueva no exige tocar el visor ni las páginas.
 */

export type SystemId =
  | 'integumentario'
  | 'subcutaneo'
  | 'muscular'
  | 'oseo'
  | 'articular'
  | 'nervioso'
  | 'cardiovascular'
  | 'respiratorio'
  | 'digestivo'
  | 'urinario'
  | 'reproductor'
  | 'linfatico';

export type Level = 'basico' | 'intermedio' | 'avanzado';
export type Side = 'l' | 'r';
export type Sex = 'male' | 'female';

export interface BodySystem {
  id: SystemId;
  name: string;
  shortName: string;
  color: string;
  /** Profundidad para la exploración por capas: 0 = más superficial. */
  depth: number;
  description: string;
}

/** Ficha anatómica de una estructura. Un único registro cubre ambos lados si es bilateral. */
export interface AnatomicalStructure {
  id: string;
  /** Término de la Nomina Anatomica Veterinaria (latín). */
  latinName: string;
  /** Nombre anatómico en español. */
  name: string;
  commonName?: string;
  system: SystemId;
  classification: string;
  region: string;
  level: Level;
  bilateral: boolean;
  sex?: Sex;
  /** Definición de una línea (se usa en preguntas de completar). */
  definition: string;
  description: string;
  location: string;
  function: string;
  /** Función resumida (se usa en preguntas de relacionar). */
  shortFunction: string;
  features: string[];
  relations: string[];
  relatedIds?: string[];
  clinical: string;
  /** Claves de la bibliografía (ver core/bibliography.ts). */
  references: string[];
  imageUrl?: string;
  reviewStatus: 'borrador' | 'revisado';
  /**
   * Plano de disección dentro de su sistema (solo músculos y fascias): determina en qué
   * paso de la exploración por capas se retira. Por defecto, superficial.
   */
  layer?: 'fascia' | 'superficial' | 'profundo';
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  category: 'orientación' | 'planos' | 'movimiento' | 'osteología' | 'general' | 'clínica';
}

export interface GuidedStep {
  id: string;
  title: string;
  level: Level;
  intro: string;
  systems: SystemId[];
  structureIds: string[];
}

/* ---------------------------- Preguntas ---------------------------- */

interface QuestionBase {
  id: string;
  prompt: string;
  explanation: string;
  topic: SystemId;
  level: Level;
  structureId?: string;
  /** true si la pregunta fue generada automáticamente a partir de las fichas. */
  generated?: boolean;
}

export interface MultipleChoiceQuestion extends QuestionBase {
  type: 'multiple';
  options: string[];
  answer: number;
}
export interface TrueFalseQuestion extends QuestionBase {
  type: 'truefalse';
  answer: boolean;
}
export interface Identify3DQuestion extends QuestionBase {
  type: 'identify3d';
  structureId: string;
}
export interface MatchQuestion extends QuestionBase {
  type: 'match';
  pairs: { left: string; right: string }[];
}
export interface FillQuestion extends QuestionBase {
  type: 'fill';
  /** Respuestas aceptadas (se comparan sin tildes ni mayúsculas). */
  answers: string[];
}

export type Question =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | Identify3DQuestion
  | MatchQuestion
  | FillQuestion;

export type QuestionType = Question['type'];

/* ---------------------------- Modelo 3D ---------------------------- */

/** Asociación malla → ficha. Las claves son nombres de malla del GLB. */
export type MeshMap = Record<string, { structureId: string; side?: Side }>;

export type ModelSource =
  | {
      kind: 'procedural';
      label: string;
      /** Se muestra siempre en el visor: el modelo NO está validado. */
      disclaimer: string;
      build: () => import('three').Group;
      /** Generación en segundo plano (Web Worker); si existe, el visor la prefiere. */
      buildAsync?: () => Promise<import('three').Group>;
    }
  | {
      kind: 'glb';
      label: string;
      url: string;
      meshMap: MeshMap;
      disclaimer?: string;
      /** Escala/rotación para alinear el GLB al sistema de coordenadas del visor. */
      transform?: { scale?: number; rotation?: [number, number, number]; position?: [number, number, number] };
    };

/** Información que el visor guarda en `mesh.userData`. */
export interface MeshInfo {
  structureId?: string;
  system?: SystemId;
  side?: Side;
  sex?: Sex;
  meshName: string;
  /** Profundidad efectiva para la exploración por capas (sistema + plano de disección). */
  layerDepth?: number;
}

export interface SpeciesManifest {
  id: string;
  name: string;
  scientificName: string;
  available: boolean;
  description: string;
  models: ModelSource[];
  structures: AnatomicalStructure[];
  questions: Question[];
  glossary: GlossaryTerm[];
  guidedPath: GuidedStep[];
}
