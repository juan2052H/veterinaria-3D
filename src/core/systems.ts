import type { BodySystem, SystemId } from './types';

/** Los 12 sistemas/capas estudiables. `depth` define el orden de retirada en la exploración por capas. */
export const SYSTEMS: BodySystem[] = [
  { id: 'integumentario', name: 'Piel y estructuras superficiales', shortName: 'Piel', color: '#d9a988', depth: 0,
    description: 'Tegumento común: piel (epidermis y dermis) y sus anexos (pelo, glándulas, almohadillas, uñas).' },
  { id: 'subcutaneo', name: 'Tejido subcutáneo', shortName: 'Subcutáneo', color: '#efd27f', depth: 1,
    description: 'Hipodermis: tejido conectivo laxo y adiposo que une la piel a las fascias subyacentes.' },
  { id: 'muscular', name: 'Sistema muscular', shortName: 'Músculos', color: '#b5473a', depth: 2,
    description: 'Músculos esqueléticos responsables de la postura y la locomoción.' },
  { id: 'linfatico', name: 'Sistema linfático', shortName: 'Linfático', color: '#5fb86a', depth: 3,
    description: 'Linfonodos, vasos linfáticos y órganos linfoides (bazo, timo).' },
  { id: 'digestivo', name: 'Sistema digestivo', shortName: 'Digestivo', color: '#c98b6b', depth: 3,
    description: 'Tubo digestivo desde la cavidad oral hasta el ano y sus glándulas anexas (hígado, páncreas).' },
  { id: 'respiratorio', name: 'Sistema respiratorio', shortName: 'Respiratorio', color: '#e89aa6', depth: 3,
    description: 'Vías aéreas (cavidad nasal, laringe, tráquea, bronquios) y pulmones.' },
  { id: 'cardiovascular', name: 'Sistema cardiovascular', shortName: 'Cardiovascular', color: '#c62828', depth: 3,
    description: 'Corazón, arterias y venas.' },
  { id: 'urinario', name: 'Sistema urinario', shortName: 'Urinario', color: '#c9a227', depth: 3,
    description: 'Riñones, uréteres, vejiga urinaria y uretra.' },
  { id: 'reproductor', name: 'Sistema reproductor', shortName: 'Reproductor', color: '#d88cc0', depth: 3,
    description: 'Órganos genitales masculinos y femeninos.' },
  { id: 'nervioso', name: 'Sistema nervioso', shortName: 'Nervioso', color: '#e6c229', depth: 4,
    description: 'Encéfalo, médula espinal y nervios periféricos.' },
  { id: 'articular', name: 'Sistema articular y ligamentoso', shortName: 'Articular', color: '#7fb6d6', depth: 5,
    description: 'Articulaciones, cápsulas articulares, ligamentos y discos intervertebrales.' },
  { id: 'oseo', name: 'Sistema óseo', shortName: 'Óseo', color: '#e8dcc4', depth: 5,
    description: 'Esqueleto axial (cráneo, columna, costillas, esternón) y apendicular (miembros).' },
];

export const SYSTEM_BY_ID: Record<SystemId, BodySystem> = Object.fromEntries(
  SYSTEMS.map((s) => [s.id, s]),
) as Record<SystemId, BodySystem>;

/**
 * Pasos de la exploración por capas (disección virtual). En cada paso se retiran las
 * estructuras cuya profundidad es menor que `depth`. Dentro del sistema muscular, las
 * fascias (1,5), los músculos superficiales (2) y los profundos (2,5) se retiran por separado.
 */
export const PEEL_STEPS = [
  { depth: 0, label: 'Completo (piel y pelaje)' },
  { depth: 1, label: 'Sin piel: tejido subcutáneo' },
  { depth: 1.5, label: 'Sin subcutáneo: fascia superficial' },
  { depth: 2, label: 'Sin fascias: músculos superficiales' },
  { depth: 2.5, label: 'Sin músculos superficiales: músculos profundos' },
  { depth: 3, label: 'Sin músculos: vísceras, vasos y nervios' },
  { depth: 4, label: 'Sin vísceras: sistema nervioso y esqueleto' },
  { depth: 5, label: 'Solo esqueleto y articulaciones' },
];

/** Profundidad de una estructura según su sistema y su plano de disección. */
export function layerDepthOf(system: SystemId, layer?: 'fascia' | 'superficial' | 'profundo') {
  const base = SYSTEM_BY_ID[system].depth;
  if (system !== 'muscular') return base;
  return layer === 'fascia' ? base - 0.5 : layer === 'profundo' ? base + 0.5 : base;
}

/** Último paso de la exploración por capas en el que una profundidad sigue visible. */
export function peelStepFor(depth: number) {
  let i = 0;
  PEEL_STEPS.forEach((s, k) => { if (s.depth <= depth) i = k; });
  return i;
}
export const LEVEL_LABEL = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' } as const;
